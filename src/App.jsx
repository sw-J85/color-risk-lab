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

// --- CONFIGURATION & LOGIC (기존 로직 엄격히 유지) ---
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
    if (grade === 'A') return { text: '매우 안전', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', desc: '컬러 리스크가 매우 낮으며, 시공 후 클레임 발생 가능성이 희박합니다.' };
    if (grade === 'B') return { text: '주의 요망', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', desc: '특정 조건 하에서 자재 간 색차 인지가 가능합니다. 고객 사전 설명이 권장됩니다.' };
    return { text: '위험군', color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', desc: '시공 전 반드시 컬러 조합 및 조명 계획을 재검토해야 하며, 부적합 리스크가 높습니다.' };
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 font-sans print:bg-white print:text-slate-900">
      
      {/* Navbar (Hidden in Print) */}
      <nav className="sticky top-0 z-50 bg-[#1e293b]/80 backdrop-blur-md border-b border-slate-700/50 px-6 py-4 flex justify-between items-center shadow-2xl print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center text-white shadow-lg">
            <ShieldAlert size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Pre-Color Risk Lab</h1>
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Diagnostic System v1.0</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {view === 'editor' ? (
            <button onClick={() => setView('report')} className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-indigo-500 transition-all shadow-lg">
              <FileText size={18} /> 리포트 생성
            </button>
          ) : (
            <>
              <button onClick={() => setView('editor')} className="flex items-center gap-2 bg-slate-800 border border-slate-700 text-slate-300 px-4 py-2.5 rounded-xl font-bold hover:bg-slate-700 transition-all">
                <ArrowLeft size={18} /> 수정하기
              </button>
              <button onClick={handlePrint} className="flex items-center gap-2 bg-white text-slate-900 px-5 py-2.5 rounded-xl font-bold hover:bg-slate-100 transition-all shadow-lg">
                <Printer size={18} /> PDF 저장
              </button>
            </>
          )}
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-6 md:p-8 print:p-0">
        {view === 'editor' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Editor Sidebar */}
            <div className="lg:col-span-4 space-y-6">
              <section className="bg-[#1e293b] rounded-3xl p-6 shadow-xl border border-slate-700/50">
                <h2 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                  <LayoutDashboard size={16} /> 프로젝트 기본 정보
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-400 mb-1.5 block">프로젝트 명</label>
                    <input 
                      type="text" 
                      placeholder="예: ○○ 아파트 리모델링"
                      className="w-full bg-[#0f172a] border border-slate-700 rounded-xl p-3 text-sm text-white focus:ring-2 focus:ring-indigo-500/50"
                      value={projectInfo.title}
                      onChange={e => setProjectInfo({...projectInfo, title: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 mb-1.5 block">공간 및 자재 대상</label>
                    <textarea 
                      rows={3}
                      className="w-full bg-[#0f172a] border border-slate-700 rounded-xl p-3 text-sm text-white focus:ring-2 focus:ring-indigo-500/50 resize-none"
                      value={projectInfo.targets}
                      onChange={e => setProjectInfo({...projectInfo, targets: e.target.value})}
                    />
                  </div>
                </div>
              </section>

              <section className="bg-gradient-to-br from-indigo-900 via-slate-900 to-[#0f172a] rounded-3xl p-8 text-white shadow-2xl relative border border-white/5">
                <p className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.3em] mb-2">실시간 리스크 지수</p>
                <div className="flex items-baseline gap-2">
                  <span className={`text-8xl font-black tracking-tighter ${analysis.grade === 'A' ? 'text-emerald-400' : analysis.grade === 'B' ? 'text-amber-400' : 'text-rose-400'}`}>
                    {analysis.grade}
                  </span>
                  <span className="text-slate-500 font-mono text-xl">/ {analysis.final.toFixed(0)}</span>
                </div>
              </section>
            </div>

            {/* Input Grid */}
            <div className="lg:col-span-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.keys(OPTIONS).map(key => (
                  <div key={key} className="bg-[#1e293b] p-5 rounded-2xl border border-slate-700/50 hover:border-indigo-500/30 transition-all group">
                    <label className="text-[10px] text-slate-500 group-hover:text-indigo-400 uppercase font-black mb-3 block tracking-widest flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-600 group-hover:bg-indigo-500"></div>
                      {key.replace('_', ' ')}
                    </label>
                    <select 
                      value={inputs[key]}
                      onChange={(e) => setInputs(prev => ({...prev, [key]: e.target.value}))}
                      className="w-full bg-[#0f172a] border border-slate-700 rounded-xl p-3 text-sm font-bold text-white outline-none focus:border-indigo-500 transition-all cursor-pointer appearance-none"
                    >
                      {OPTIONS[key].map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* --- A4 SINGLE PAGE REPORT VIEW --- */
          <div ref={reportRef} className="report-container bg-white text-slate-900 shadow-2xl p-10 md:p-12 max-w-4xl mx-auto print:shadow-none print:p-0 print:max-w-none">
            
            {/* Header: Compact */}
            <header className="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-6">
              <div>
                <div className="flex items-center gap-1.5 text-indigo-600 font-black tracking-widest text-[10px] mb-1">
                  <ShieldAlert size={14} /> PRE-COLOR RISK LAB
                </div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">컬러 리스크 사전 검증 보고서</h1>
                <p className="text-[10px] text-slate-400 font-semibold tracking-tighter uppercase mt-0.5">Automated Risk Assessment Diagnosis • Interior/Material Verification</p>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-slate-400 font-mono">CODE: PR-V1-{new Date().getTime().toString().slice(-6)}</div>
                <div className="text-[10px] font-bold text-slate-600 uppercase mt-1">DATE: {new Date().toLocaleDateString()}</div>
              </div>
            </header>

            {/* Grid Layout for Content */}
            <div className="grid grid-cols-12 gap-x-6 gap-y-4">
              
              {/* Left Column: Stats & Grade (A4 1/3 Width) */}
              <div className="col-span-12 md:col-span-4 space-y-4">
                {/* 01. Overview */}
                <section className="print-section">
                  <h3 className="section-title">01. 프로젝트 개요</h3>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                    <div>
                      <p className="label">프로젝트 명</p>
                      <p className="value-sm">{projectInfo.title || "미지정 프로젝트"}</p>
                    </div>
                    <div>
                      <p className="label">분석 대상</p>
                      <p className="value-sm text-indigo-600 font-bold">{projectInfo.targets}</p>
                    </div>
                  </div>
                </section>

                {/* 02. Grade Score Box */}
                <section className="print-section">
                   <h3 className="section-title">02. 진단 리스크 등급</h3>
                   <div className={`p-6 rounded-2xl border-2 text-center ${getStatusText(analysis.grade).border} ${getStatusText(analysis.grade).bg}`}>
                      <p className="label mb-2">Verification Grade</p>
                      <div className={`text-7xl font-black leading-none mb-2 ${getStatusText(analysis.grade).color}`}>
                        {analysis.grade}
                      </div>
                      <p className={`text-xs font-black uppercase tracking-widest ${getStatusText(analysis.grade).color}`}>
                        {getStatusText(analysis.grade).text}
                      </p>
                      <div className="mt-4 pt-4 border-t border-slate-200/50 grid grid-cols-2 gap-2">
                        <div>
                          <p className="label">Score</p>
                          <p className="font-mono font-bold text-sm">{analysis.final.toFixed(1)}</p>
                        </div>
                        <div>
                          <p className="label">Status</p>
                          <p className="font-bold text-[9px]">{analysis.grade === 'A' ? 'CLEAN' : 'MONITOR'}</p>
                        </div>
                      </div>
                   </div>
                </section>

                {/* Info Text */}
                <p className="text-[9px] leading-relaxed text-slate-400 italic">
                  * 본 진단 결과는 입력된 조명 및 자재 데이터를 기반으로 산출된 예측치이며, 실제 환경의 미세한 변수에 따라 달라질 수 있습니다.
                </p>
              </div>

              {/* Right Column: Details & Insights (A4 2/3 Width) */}
              <div className="col-span-12 md:col-span-8 space-y-4">
                
                {/* 03. Diagnosis Summary */}
                <section className="print-section">
                  <h3 className="section-title">03. 종합 진단 소견</h3>
                  <div className="bg-slate-900 text-white p-5 rounded-xl shadow-md">
                    <p className="text-sm font-bold leading-snug">
                      {getStatusText(analysis.grade).desc}
                    </p>
                    <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-700 pt-3">
                       <div className="text-center">
                          <p className="label text-slate-500">조명 변수</p>
                          <p className="font-mono text-xs">{analysis.L.toFixed(1)}</p>
                       </div>
                       <div className="text-center border-x border-slate-700 px-2">
                          <p className="label text-slate-500">자재 특성</p>
                          <p className="font-mono text-xs">{analysis.M.toFixed(1)}</p>
                       </div>
                       <div className="text-center">
                          <p className="label text-slate-500">공간 변수</p>
                          <p className="font-mono text-xs">{analysis.S.toFixed(1)}</p>
                       </div>
                    </div>
                  </div>
                </section>

                {/* 04. Detailed Risk Indicators */}
                <section className="print-section">
                  <h3 className="section-title">04. 세부 위험 지표 분석</h3>
                  <div className="space-y-1.5">
                    {analysis.fired.length > 0 ? (
                      analysis.fired.map(rule => (
                        <div key={rule.id} className="flex justify-between items-center bg-slate-50 border border-slate-100 px-3 py-2.5 rounded-lg">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div>
                            <span className="text-[11px] font-bold text-slate-700">{rule.title}</span>
                          </div>
                          <span className="text-[10px] font-mono font-bold text-rose-600">+{rule.points}pt</span>
                        </div>
                      ))
                    ) : (
                      <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-lg flex items-center gap-2">
                        <CheckCircle2 size={14} className="text-emerald-500" />
                        <span className="text-[10px] font-bold text-emerald-800">특이할 만한 복합 리스크 요인이 발견되지 않았습니다.</span>
                      </div>
                    )}
                  </div>
                </section>

                {/* 05. Action Plan */}
                <section className="print-section">
                  <h3 className="section-title">05. 전문가 개선 가이드</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/50">
                      <p className="text-[10px] font-black text-indigo-600 uppercase mb-2 flex items-center gap-1">
                        <Settings size={12} /> Technical Adjustment
                      </p>
                      <ul className="text-[10px] text-slate-600 space-y-1.5 list-disc pl-3 font-medium leading-tight">
                        <li>조명 연색성(CRI) 90Ra 이상 광원 교체 검토</li>
                        <li>{inputs.Surface === 'Gloss' ? '고광택면 반사각 고려 위치 조정' : '표면 텍스처 강조용 사선 조명 배치'}</li>
                        <li>색차 발생 구간 샘플 보드 현장 대조 필요</li>
                      </ul>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <p className="text-[10px] font-black text-slate-800 uppercase mb-2 flex items-center gap-1">
                        <FileText size={12} /> Communication Note
                      </p>
                      <p className="text-[10px] text-slate-500 leading-tight italic">
                        "{analysis.grade === 'A' ? '현 조합의 시각적 안정성을 강조하여 신뢰를 확보하십시오.' : '환경에 따른 미세 색차 가능성을 미리 언급하여 시공 후 클레임을 방지하십시오.'}"
                      </p>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            {/* Footer: Single Line */}
            <footer className="mt-8 pt-4 border-t border-slate-100 flex justify-between items-center opacity-60">
              <div className="text-[8px] font-bold uppercase tracking-widest text-slate-400">Pre-Color Lab • Diagnostic Verification Document</div>
              <div className="flex items-center gap-4 text-[8px] font-black">
                <span>(C) RISK ANALYSIS SYSTEM</span>
                <span>PAGE 01 / 01</span>
              </div>
            </footer>
          </div>
        )}
      </main>

      {/* Decorative BG (Hidden in print) */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden print:hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/5 rounded-full blur-[120px]" />
      </div>

      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          body { 
            background: white !important; 
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact !important; 
            print-color-adjust: exact !important; 
          }
          .print\\:hidden { display: none !important; }
          .report-container { 
            width: 210mm; /* A4 Width */
            height: 297mm; /* A4 Height */
            margin: 0 auto !important;
            padding: 15mm 15mm !important; /* Standard report margins */
            box-sizing: border-box;
            box-shadow: none !important;
            border: none !important;
            overflow: hidden; /* Strict 1-page control */
          }
          /* High-density typography for print */
          .section-title {
            font-size: 11px !important;
            font-weight: 900 !important;
            margin-bottom: 8px !important;
            border-left: 3px solid #0f172a !important;
            padding-left: 6px !important;
            text-transform: uppercase;
            letter-spacing: -0.02em;
          }
          .label {
            font-size: 8px !important;
            font-weight: 800 !important;
            color: #94a3b8 !important;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          .value-sm {
            font-size: 11px !important;
            font-weight: 700 !important;
          }
        }

        /* Screen Styles for Report */
        .section-title {
          font-size: 13px;
          font-weight: 900;
          margin-bottom: 12px;
          border-left: 3px solid #0f172a;
          padding-left: 8px;
          text-transform: uppercase;
        }
        .label {
          font-size: 10px;
          font-weight: 800;
          color: #94a3b8;
          text-transform: uppercase;
          margin-bottom: 2px;
        }
        .value-sm {
          font-size: 13px;
          font-weight: 700;
        }
        
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
      `}</style>
    </div>
  );
}