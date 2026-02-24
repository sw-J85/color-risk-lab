import React, { useState, useMemo, useRef } from 'react';
import { 
  ShieldAlert, 
  FileText, 
  Settings, 
  Download, 
  ChevronRight, 
  AlertTriangle, 
  CheckCircle2, 
  Lightbulb,
  Printer,
  LayoutDashboard,
  ArrowLeft
} from 'lucide-react';

// --- CONFIGURATION & LOGIC ---
const CONFIG = {
  weights: {
    layer: { Lighting: 0.40, Material: 0.35, Spatial: 0.25 },
    Lighting: { Light_Type: 0.25, CCT: 0.30, CRI: 0.25, Lux: 0.20 },
    Material: { Surface: 0.25, Material_Type: 0.30, Chroma: 0.25, Lot_Variation: 0.20 },
    Spatial: { Space_Type: 0.35, Viewing_Distance: 0.30, Combination_Count: 0.35 }
  },
  scores: {
    Light_Type: { "Single": 30, "Mixed": 75 },
    CCT: { "Warm": 45, "Neutral": 55, "Cool": 65 },
    CRI: { "High": 30, "Mid": 55, "Low": 75 },
    Lux: { "Low": 40, "Mid": 55, "High": 70 },
    Surface: { "Matte": 35, "Semi": 55, "Gloss": 75 },
    Material_Type: { "Tile": 45, "Paint": 60, "Film": 70, "Plastic": 65, "Fabric": 55 },
    Chroma: { "Neutral": 45, "Low": 55, "High": 70 },
    Lot_Variation: { "Low": 40, "Mid": 60, "High": 75 },
    Space_Type: { "Residential": 50, "Commercial": 65, "Exhibition": 70, "Medical": 60 },
    Viewing_Distance: { "Far": 40, "Mid": 55, "Near": 70 },
    Combination_Count: { "1-2": 35, "3-4": 55, "5+": 75 },
    Area_Size: { "Small": 35, "Medium": 55, "Large": 75 }
  },
  rules: [
    { id: "R1", title: "혼합 광원 + 다중 조합 리스크", points: 12, when: "inputs.Light_Type === 'Mixed' && inputs.Combination_Count === '5+'" },
    { id: "R2", title: "유광 표면 + 고조도 반사 리스크", points: 12, when: "inputs.Surface === 'Gloss' && inputs.Lux === 'High'" },
    { id: "R3", title: "저연색성(Low CRI) 색 왜곡", points: 8, when: "inputs.CRI === 'Low'" },
    { id: "R4", title: "대면적 색 인지 오차 리스크", points: 10, when: "inputs.Area_Size === 'Large'" },
    { id: "R6", title: "로트(Lot) 편차 시각적 노이즈", points: 10, when: "inputs.Lot_Variation === 'High'" }
  ],
  grading: { A_max: 34, B_max: 64 }
};

const OPTIONS = {
  Light_Type: [{v:"Single",l:"단일 광원"},{v:"Mixed",l:"혼합/복수 광원"}],
  CCT: [{v:"Warm",l:"Warm (≤3000K)"},{v:"Neutral",l:"Neutral (3~4K)"},{v:"Cool",l:"Cool (≥4000K)"}],
  CRI: [{v:"High",l:"High (90↑)"},{v:"Mid",l:"Mid (80~90)"},{v:"Low",l:"Low (80↓)"}],
  Lux: [{v:"Low",l:"저조도"},{v:"Mid",l:"중간"},{v:"High",l:"고조도"}],
  Surface: [{v:"Matte",l:"무광"},{v:"Semi",l:"반무광"},{v:"Gloss",l:"유광"}],
  Material_Type: [{v:"Tile",l:"타일"},{v:"Paint",l:"도장"},{v:"Film",l:"필름"},{v:"Plastic",l:"플라스틱"},{v:"Fabric",l:"패브릭"}],
  Chroma: [{v:"Neutral",l:"무채색"},{v:"Low",l:"저채도"},{v:"High",l:"고채도"}],
  Lot_Variation: [{v:"Low",l:"낮음"},{v:"Mid",l:"중간"},{v:"High",l:"높음"}],
  Space_Type: [{v:"Residential",l:"주거"},{v:"Commercial",l:"상업"},{v:"Exhibition",l:"전시"},{v:"Medical",l:"의료"}],
  Viewing_Distance: [{v:"Far",l:"원거리"},{v:"Mid",l:"중거리"},{v:"Near",l:"근거리"}],
  Combination_Count: [{v:"1-2",l:"1~2개"},{v:"3-4",l:"3~4개"},{v:"5+",l:"5개 이상"}],
  Area_Size: [{v:"Small",l:"소면적"},{v:"Medium",l:"중면적"},{v:"Large",l:"대면적"}]
};

export default function App() {
  const [view, setView] = useState('editor');
  const [projectInfo, setProjectInfo] = useState({
    title: '',
    client: '',
    location: '',
    targets: '벽체(White), 바닥(Oak), 가구(Neutral)'
  });
  
  const [inputs, setInputs] = useState(() => {
    const init = {};
    Object.keys(OPTIONS).forEach(k => init[k] = OPTIONS[k][0].v);
    return init;
  });

  const reportRef = useRef(null);

  const analysis = useMemo(() => {
    const getS = (f, v) => CONFIG.scores[f]?.[v] || 0;
    
    const L = (getS('Light_Type', inputs.Light_Type) * CONFIG.weights.Lighting.Light_Type) +
              (getS('CCT', inputs.CCT) * CONFIG.weights.Lighting.CCT) +
              (getS('CRI', inputs.CRI) * CONFIG.weights.Lighting.CRI) +
              (getS('Lux', inputs.Lux) * CONFIG.weights.Lighting.Lux);

    const M = (getS('Surface', inputs.Surface) * CONFIG.weights.Material.Surface) +
              (getS('Material_Type', inputs.Material_Type) * CONFIG.weights.Material.Material_Type) +
              (getS('Chroma', inputs.Chroma) * CONFIG.weights.Material.Chroma) +
              (getS('Lot_Variation', inputs.Lot_Variation) * CONFIG.weights.Material.Lot_Variation);

    const S = (getS('Space_Type', inputs.Space_Type) * CONFIG.weights.Spatial.Space_Type) +
              (getS('Viewing_Distance', inputs.Viewing_Distance) * CONFIG.weights.Spatial.Viewing_Distance) +
              (getS('Combination_Count', inputs.Combination_Count) * CONFIG.weights.Spatial.Combination_Count);

    const base = (L * CONFIG.weights.layer.Lighting) + (M * CONFIG.weights.layer.Material) + (S * CONFIG.weights.layer.Spatial);

    let adjust = 0;
    const fired = [];
    CONFIG.rules.forEach(r => {
      try {
        const check = new Function('inputs', `return ${r.when}`);
        if (check(inputs)) {
          adjust += r.points;
          fired.push(r);
        }
      } catch (e) { console.error(e); }
    });

    const final = Math.min(100, base + adjust);
    let grade = "C";
    if (final <= CONFIG.grading.A_max) grade = "A";
    else if (final <= CONFIG.grading.B_max) grade = "B";
    
    return { L, M, S, base, adjust, final, grade, fired };
  }, [inputs]);

  const handlePrint = () => {
    window.print();
  };

  const getStatusText = (grade) => {
    if (grade === 'A') return { text: '매우 안전', color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200', desc: '컬러 리스크가 매우 낮으며, 시공 후 클레임 발생 가능성이 희박합니다.' };
    if (grade === 'B') return { text: '주의 요망', color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-200', desc: '특정 조건 하에서 자재 간 색차 인지가 가능합니다. 고객 사전 설명이 권장됩니다.' };
    return { text: '위험군', color: 'text-rose-500', bg: 'bg-rose-50', border: 'border-rose-200', desc: '시공 전 반드시 컬러 조합 및 조명 계획을 재검토해야 하며, 부적합 리스크가 높습니다.' };
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans print:bg-white print:p-0">
      
      <nav className="sticky top-0 z-50 bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
            <ShieldAlert size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">Pre-Color Risk Lab</h1>
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Diagnostic System Beta</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {view === 'editor' ? (
            <button 
              onClick={() => setView('report')}
              className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md active:scale-95"
            >
              <FileText size={18} /> 리포트 생성
            </button>
          ) : (
            <>
              <button 
                onClick={() => setView('editor')}
                className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2.5 rounded-xl font-bold hover:bg-slate-50 transition-all active:scale-95"
              >
                <ArrowLeft size={18} /> 수정하기
              </button>
              <button 
                onClick={handlePrint}
                className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-black transition-all shadow-md active:scale-95"
              >
                <Printer size={18} /> PDF 저장/인쇄
              </button>
            </>
          )}
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-6 md:p-8">
        {view === 'editor' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4 space-y-6">
              <section className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                  <LayoutDashboard size={16} /> 프로젝트 기본 정보
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1.5 block">프로젝트 명</label>
                    <input 
                      type="text" 
                      placeholder="예: ○○ 아파트 34평 리모델링"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      value={projectInfo.title}
                      onChange={e => setProjectInfo({...projectInfo, title: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1.5 block">공간 및 자재 대상</label>
                    <textarea 
                      rows={3}
                      placeholder="분석 대상 자재 및 조명을 입력하세요"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                      value={projectInfo.targets}
                      onChange={e => setProjectInfo({...projectInfo, targets: e.target.value})}
                    />
                  </div>
                </div>
              </section>

              <section className="bg-slate-900 rounded-3xl p-8 text-white shadow-xl overflow-hidden relative group">
                <div className={`absolute top-0 right-0 w-24 h-24 blur-3xl opacity-20 rounded-full ${analysis.grade === 'A' ? 'bg-emerald-500' : analysis.grade === 'B' ? 'bg-amber-500' : 'bg-rose-500'}`} />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">실시간 리스크 지수</p>
                <div className="flex items-baseline gap-2">
                  <span className={`text-7xl font-black ${analysis.grade === 'A' ? 'text-emerald-400' : analysis.grade === 'B' ? 'text-amber-400' : 'text-rose-400'}`}>
                    {analysis.grade}
                  </span>
                  <span className="text-slate-500 font-mono">/ SCORE {analysis.final.toFixed(0)}</span>
                </div>
                <div className="mt-6 flex gap-2">
                   <div className="px-3 py-1 bg-white/10 rounded-full text-[11px] font-bold">Base {analysis.base.toFixed(0)}</div>
                   <div className="px-3 py-1 bg-white/10 rounded-full text-[11px] font-bold">Adj +{analysis.adjust}</div>
                </div>
              </section>
            </div>

            <div className="lg:col-span-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.keys(OPTIONS).map(key => (
                  <div key={key} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                    <label className="text-[10px] text-slate-400 uppercase font-black mb-2 block tracking-wider flex items-center gap-1.5">
                      <div className="w-1 h-1 rounded-full bg-indigo-500"></div>
                      {key.replace('_', ' ')}
                    </label>
                    <select 
                      value={inputs[key]}
                      onChange={(e) => setInputs(prev => ({...prev, [key]: e.target.value}))}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-semibold outline-none focus:border-indigo-500 transition-colors cursor-pointer appearance-none"
                    >
                      {OPTIONS[key].map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div ref={reportRef} className="bg-white shadow-2xl rounded-none md:rounded-3xl p-8 md:p-16 max-w-4xl mx-auto print:shadow-none print:p-0 print:max-w-none">
            
            <div className="border-b-4 border-slate-900 pb-8 mb-12 flex justify-between items-end">
              <div>
                <div className="flex items-center gap-2 text-indigo-600 font-black tracking-widest text-sm mb-4">
                  <ShieldAlert size={20} /> PRE-COLOR RISK LAB
                </div>
                <h1 className="text-4xl font-black text-slate-900 leading-tight">
                  컬러 리스크 사전 검증 보고서
                </h1>
                <p className="text-slate-500 mt-2 font-medium">Color Risk Pre-Verification Report</p>
              </div>
              <div className="text-right text-sm text-slate-400 font-mono">
                REF: {new Date().toISOString().slice(0,10).replace(/-/g, '')}-BETA<br />
                DATE: {new Date().toLocaleDateString()}
              </div>
            </div>

            <section className="mb-12">
              <h3 className="text-lg font-black flex items-center gap-2 mb-6 border-l-4 border-slate-900 pl-4 uppercase tracking-tighter">
                01. 프로젝트 개요
              </h3>
              <div className="grid grid-cols-2 gap-y-6 bg-slate-50 p-8 rounded-2xl">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase mb-1">프로젝트명</p>
                  <p className="text-lg font-bold">{projectInfo.title || "미정"}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase mb-1">검증 대상</p>
                  <p className="text-lg font-bold text-indigo-600">{projectInfo.targets}</p>
                </div>
                <div className="col-span-2 pt-4 border-t border-slate-200">
                  <p className="text-xs font-bold text-slate-400 uppercase mb-1">분석 목적</p>
                  <p className="text-sm leading-relaxed text-slate-600">
                    본 보고서는 시공 전 단계에서 자재 간 색차 및 조명 조건에 따른 체감 색상 변화를 예측하여 시공 후 발생할 수 있는 클레임 리스크를 사전 점검합니다.
                  </p>
                </div>
              </div>
            </section>

            <section className="mb-12">
              <h3 className="text-lg font-black flex items-center gap-2 mb-6 border-l-4 border-slate-900 pl-4 uppercase tracking-tighter">
                02. 종합 리스크 진단
              </h3>
              <div className="flex flex-col md:flex-row gap-8 items-center border border-slate-200 rounded-3xl p-10">
                <div className="text-center md:border-r border-slate-100 pr-0 md:pr-12 w-full md:w-auto">
                  <p className="text-xs font-black text-slate-400 uppercase mb-4 tracking-widest">리스크 등급</p>
                  <div className={`text-9xl font-black leading-none ${getStatusText(analysis.grade).color}`}>
                    {analysis.grade}
                  </div>
                </div>
                <div className="flex-1 space-y-4">
                  <div className={`inline-block px-4 py-1.5 rounded-full font-black text-sm ${getStatusText(analysis.grade).bg} ${getStatusText(analysis.grade).color}`}>
                    상태: {getStatusText(analysis.grade).text}
                  </div>
                  <h4 className="text-2xl font-bold text-slate-800 leading-tight">
                    {getStatusText(analysis.grade).desc}
                  </h4>
                  <div className="pt-4 grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">조명 인지</p>
                      <p className="font-mono font-bold text-lg">{analysis.L.toFixed(0)}</p>
                    </div>
                    <div className="text-center border-x border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">자재 특성</p>
                      <p className="font-mono font-bold text-lg">{analysis.M.toFixed(0)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">공간 변수</p>
                      <p className="font-mono font-bold text-lg">{analysis.S.toFixed(0)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="mb-12">
               <h3 className="text-lg font-black flex items-center gap-2 mb-6 border-l-4 border-slate-900 pl-4 uppercase tracking-tighter">
                03. 상세 리스크 감지 내역
              </h3>
              <div className="space-y-4">
                {analysis.fired.length > 0 ? (
                  analysis.fired.map(rule => (
                    <div key={rule.id} className="flex items-start gap-4 bg-slate-50 p-6 rounded-2xl border-l-4 border-indigo-500">
                      <AlertTriangle className="text-indigo-500 mt-1 flex-shrink-0" size={24} />
                      <div>
                        <h4 className="font-bold text-slate-800 text-lg mb-1">{rule.title}</h4>
                        <p className="text-sm text-slate-500">조합 조건 및 환경 변수가 결합되어 시각적 불일치를 초래할 리스크 점수 +{rule.points}점이 가산되었습니다.</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="bg-emerald-50 p-6 rounded-2xl border-l-4 border-emerald-500 flex items-center gap-4">
                    <CheckCircle2 className="text-emerald-500" size={24} />
                    <p className="font-bold text-emerald-800">특이할 만한 복합 리스크가 발견되지 않았습니다. 표준 공정 준수가 권장됩니다.</p>
                  </div>
                )}
              </div>
            </section>

            <section className="mb-12">
               <h3 className="text-lg font-black flex items-center gap-2 mb-6 border-l-4 border-slate-900 pl-4 uppercase tracking-tighter">
                04. 전문가 개선 제안
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-6 bg-indigo-50 rounded-2xl border border-indigo-100">
                  <Lightbulb className="text-indigo-600 mb-3" size={28} />
                  <h4 className="font-black text-slate-800 mb-2">설계 조정 제안</h4>
                  <ul className="text-sm text-slate-600 space-y-2 list-disc pl-4 leading-relaxed">
                    <li>{inputs.CCT === 'Warm' ? '조명 온도를 3500K 정도로 높여 노란기를 억제하세요.' : '조명 채도와 자재의 반사율을 고려한 조도 조절이 필요합니다.'}</li>
                    <li>{inputs.Surface === 'Gloss' ? '유광 자재의 하이라이트 분산을 위해 간접광 사용을 권장합니다.' : '무광 자재 특유의 깊이감을 위해 연색성 90 이상의 광원을 사용하세요.'}</li>
                  </ul>
                </div>
                <div className="p-6 bg-slate-900 rounded-2xl text-white shadow-xl shadow-slate-200">
                  <FileText className="text-indigo-400 mb-3" size={28} />
                  <h4 className="font-black mb-2">설명 요약 (Client Message)</h4>
                  <p className="text-sm text-slate-300 leading-relaxed italic border-l-2 border-indigo-500/50 pl-4 py-2">
                    "현재 선택하신 {projectInfo.targets} 조합은 {analysis.grade === 'A' ? '시각적으로 조화로운 안정적인 조합' : '조명 환경에 따라 색상 차이가 느껴질 수 있는 조건'}입니다. {analysis.grade !== 'A' && '특히 밤시간대 인공 조명 하에서의 색감을 미리 확인하시길 권장드립니다.'}"
                  </p>
                </div>
              </div>
            </section>

            <div className="mt-24 pt-8 border-t border-slate-100 flex justify-between items-center text-xs font-black text-slate-400 uppercase tracking-widest">
              <div>Pre-Color Risk Lab Certified</div>
              <div className="flex items-center gap-1.5"><ShieldAlert size={12} /> Designed for Zero Complaint</div>
            </div>
          </div>
        )}
      </main>

      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden print:hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-100/40 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-100/40 rounded-full blur-[120px]" />
      </div>

      <style>{`
        @media print {
          body { background: white; }
          .print\\:hidden { display: none !important; }
          main { padding: 0 !important; max-width: 100% !important; }
          @page { margin: 1cm; }
        }
      `}</style>
    </div>
  );
}
