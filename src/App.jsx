import { useState, useEffect, useMemo, useCallback } from "react";
import { dbGet, dbSet } from "./firebase";

const DEFAULT_PASSWORD = "nekono2024";
const SK = { properties:"props", cases:"cases", cleaning:"clean", settings:"cfg", staff:"staff", monthcnt:"monthcnt", password:"password" };
const DEFAULT_STAFF = [{name:"公文",taxTarget:true},{name:"広田",taxTarget:true},{name:"ねこのて",taxTarget:true}];
const DEFAULT_PROPS = [
  {id:1,  name:"アメックス長尾ヒルズ",      fee:30000, cnt:9},
  {id:2,  name:"ティエドール柚須",           fee:8000,  cnt:4},
  {id:3,  name:"グランリヴィエラ",            fee:5000,  cnt:4},
  {id:4,  name:"ラヴィータ美松",              fee:10000, cnt:5},
  {id:5,  name:"フローレス長尾",              fee:10000, cnt:5},
  {id:6,  name:"塔原サンハイツ",              fee:6600,  cnt:1},
  {id:7,  name:"ビオニール1",                 fee:8000,  cnt:2},
  {id:8,  name:"ホークヒルズ那珂川",          fee:2500,  cnt:1},
  {id:9,  name:"サニーガーデン那珂川",        fee:5000,  cnt:2},
  {id:10, name:"アプリーレ1",                fee:2500,  cnt:1},
  {id:11, name:"サニータウン次郎丸",          fee:2500,  cnt:1},
  {id:12, name:"ホークヒルズ古賀",            fee:8000,  cnt:4},
  {id:13, name:"ホーユーコンフォルト大濠公",  fee:12000, cnt:4},
  {id:14, name:"グレースコート",              fee:12000, cnt:2},
  {id:15, name:"第5サンシャイン",             fee:25300, cnt:5},
  {id:16, name:"グランドシャルマン",          fee:17280, cnt:4},
  {id:17, name:"レクサスガーデン",            fee:17600, cnt:4},
  {id:18, name:"サニーガーデン安井野",        fee:8800,  cnt:5},
  {id:19, name:"アクセス",                    fee:14000, cnt:2},
  {id:20, name:"鞍山コーポ",                  fee:4000,  cnt:2},
];
const DEFAULT_CFG = { fixedCost:125000, taxRate:3 };

const yen = n => "¥"+Math.round(Number(n)||0).toLocaleString();
const toDay = () => new Date().toISOString().slice(0,10);
const toMonth = () => new Date().toISOString().slice(0,7);
const nextMo = ym => { const [y,m]=ym.split("-").map(Number); return m===12?`${y+1}-01`:`${y}-${String(m+1).padStart(2,"0")}`; };

// スタッフ名リスト取得ヘルパー
const stNames = list => list.map(s => typeof s === "string" ? s : s.name);
const stTaxTarget = (list, name) => { const s = list.find(s => (typeof s === "string" ? s : s.name) === name); return s ? (typeof s === "string" ? true : s.taxTarget !== false) : true; };

// 月ごとの物件月回数キー
const mcKey = (month, pid) => `${month}-cnt-${pid}`;
// 月ごとの担当回数キー
const cdKey = (month, pid, st) => `${month}-${pid}-${st}`;

// スタッフの売上計算：月額×(担当回数/月回数)、合計が月額に一致するよう最後で調整
function calcStaffSales(fee, monthCnt, staffCounts, staffList) {
  if (!monthCnt || monthCnt === 0) return staffList.map(() => 0);
  const totalStaffCnt = staffList.reduce((s, st) => s + (staffCounts[st] || 0), 0);
  if (totalStaffCnt === 0) return staffList.map(() => 0);

  // 各スタッフの按分（切り捨て）
  let sales = staffList.map(st => Math.floor(fee * (staffCounts[st] || 0) / monthCnt));
  // 端数を最後の作業者に加算して合計=担当分の月額になるように調整
  const distributed = Math.round(fee * totalStaffCnt / monthCnt);
  const sumSales = sales.reduce((a, b) => a + b, 0);
  const diff = distributed - sumSales;
  // 最後に回数があるスタッフに端数を足す
  for (let i = staffList.length - 1; i >= 0; i--) {
    if ((staffCounts[staffList[i]] || 0) > 0) {
      sales[i] += diff;
      break;
    }
  }
  return sales;
}

// 数字入力コンポーネント
function NumInput({ value, onCommit, style, min = 0 }) {
  const [local, setLocal] = useState(String(value ?? ""));
  useEffect(() => { setLocal(String(value ?? "")); }, [value]);
  const handleChange = e => { if (e.target.value === "" || /^-?\d*$/.test(e.target.value)) setLocal(e.target.value); };
  const handleBlur = () => {
    const num = Math.max(min, Number(local) || 0);
    setLocal(String(num));
    if (onCommit) onCommit(num);
  };
  return (
    <input type="text" inputMode="numeric" value={local}
      onChange={handleChange} onBlur={handleBlur}
      onKeyDown={e => e.key==="Enter" && e.target.blur()}
      onFocus={e => e.target.select()} style={style} />
  );
}

// ログイン
function Login({onLogin, password}) {
  const [pw,setPw]=useState(""); const [err,setErr]=useState(false); const [shake,setShake]=useState(false);
  const go=()=>{ if(pw===password) onLogin(); else {setErr(true);setShake(true);setTimeout(()=>setShake(false),500);}};
  return (
    <div style={S.loginBg}>
      <style>{css}</style>
      <div style={{...S.loginCard, animation:shake?"shake .4s":"rise .5s ease"}}>
        <div style={S.loginIcon}>🐾</div>
        <div style={S.loginTitle}>便利屋 ねこのて</div>
        <div style={S.loginSub}>売上管理システム</div>
        <input style={{...S.loginInput, borderColor:err?"#ff6b6b":"#441111"}}
          type="password" placeholder="パスワードを入力" value={pw}
          onChange={e=>{setPw(e.target.value);setErr(false);}}
          onKeyDown={e=>e.key==="Enter"&&go()} autoFocus/>
        {err&&<p style={{color:"#ff6b6b",fontSize:12,marginTop:-4}}>パスワードが違います</p>}
        <button style={S.loginBtn} onClick={go}>ログイン</button>
      </div>
    </div>
  );
}

// メインアプリ
export default function App() {
  const [authed,setAuthed]=useState(false);
  const [tab,setTab]=useState("cleaning");
  const [month,setMonth]=useState(toMonth());
  const [props,setProps]=useState(DEFAULT_PROPS);
  const [staffList,setStaffList]=useState(DEFAULT_STAFF);
  const [cleanData,setCleanData]=useState({});   // 担当回数 key=cdKey
  const [monthCntData,setMonthCntData]=useState({}); // 月回数 key=mcKey
  const [cases,setCases]=useState([]);
  const [cfg,setCfg]=useState(DEFAULT_CFG);
  const [toast,setToast]=useState("");
  const [loading,setLoading]=useState(true);
  const [password,setPassword]=useState(DEFAULT_PASSWORD);

  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(""),2500); };

  useEffect(()=>{
    // パスワードをFirebaseから先に読み込む
    (async()=>{
      const savedPw = await dbGet(SK.password);
      if(savedPw) setPassword(savedPw);
    })();
  },[]);

  useEffect(()=>{
    if(!authed)return;
    (async()=>{
      const [p,cl,ca,c,sf,mc] = await Promise.all([
        dbGet(SK.properties), dbGet(SK.cleaning), dbGet(SK.cases),
        dbGet(SK.settings), dbGet(SK.staff), dbGet(SK.monthcnt)
      ]);
      if(p)setProps(p); if(cl)setCleanData(cl); if(ca)setCases(ca);
      if(c)setCfg(c); if(sf)setStaffList(sf); if(mc)setMonthCntData(mc);
      setLoading(false);
    })();
  },[authed]);

  const savePassword = async v => { setPassword(v);    await dbSet(SK.password,   v); };
  const saveProps    = async v => { setProps(v);        await dbSet(SK.properties, v); };
  const saveClean    = async v => { setCleanData(v);    await dbSet(SK.cleaning,   v); };
  const saveMonthCnt = async v => { setMonthCntData(v); await dbSet(SK.monthcnt,   v); };
  const saveCases    = async v => { setCases(v);        await dbSet(SK.cases,      v); };
  const saveCfg      = async v => { setCfg(v);          await dbSet(SK.settings,   v); };
  const saveStaff    = async v => { setStaffList(v);    await dbSet(SK.staff,      v); };

  // 翌月コピー：担当回数は0リセット、月回数は引き継ぎ
  const carryOver = async () => {
    const nm = nextMo(month);
    const newClean = {...cleanData};
    const newMc = {...monthCntData};
    props.forEach(p => {
      // 月回数を引き継ぎ
      const curCnt = monthCntData[mcKey(month, p.id)] ?? p.cnt;
      if (!(mcKey(nm, p.id) in newMc)) newMc[mcKey(nm, p.id)] = curCnt;
      // 担当回数は0でセット
      staffList.forEach(s => {
        const k = cdKey(nm, p.id, s);
        if (!(k in newClean)) newClean[k] = 0;
      });
    });
    await saveClean(newClean);
    await saveMonthCnt(newMc);
    setMonth(nm);
    showToast(`✅ ${nm} にコピーしました`);
  };

  if(!authed) return <Login onLogin={()=>setAuthed(true)} password={password}/>;

  const tabs=[["cleaning","🏠 日常清掃"],["cases","📋 案件"],["closing","📊 月末締め"],["cfg","⚙️ 設定"]];

  return (
    <div style={S.app}>
      <style>{css}</style>
      {toast && <div style={S.toast}>{toast}</div>}
      <div style={S.header}>
        <span style={{fontSize:22}}>🐾</span>
        <div style={{flex:1,marginLeft:10}}>
          <div style={S.hTitle}>便利屋 ねこのて</div>
          <div style={S.hSub}>売上管理システム</div>
        </div>
        <div style={{textAlign:"right",marginRight:10}}>
          <div style={{fontSize:10,color:"rgba(255,255,255,0.5)",marginBottom:2}}>対象月</div>
          <input type="month" value={month} onChange={e=>setMonth(e.target.value)}
            style={{background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",fontSize:13,fontWeight:700,borderRadius:6,padding:"3px 8px",outline:"none",width:"auto"}}/>
        </div>
        <button style={S.logoutBtn} onClick={()=>setAuthed(false)}>ログアウト</button>
      </div>
      <div style={S.tabs}>
        {tabs.map(([k,v])=>(
          <button key={k} style={{...S.tab,...(tab===k?S.tabOn:{})}} onClick={()=>setTab(k)}>{v}</button>
        ))}
      </div>
      <div style={S.body}>
        {loading ? <div style={S.empty}>読み込み中…</div> : <>
          {tab==="cleaning" && <CleaningTab month={month} props={props} staffList={staffList} cleanData={cleanData} saveClean={saveClean} monthCntData={monthCntData} saveMonthCnt={saveMonthCnt} carryOver={carryOver}/>}
          {tab==="cases"    && <CasesTab    month={month} cases={cases} staffList={staffList} saveCases={saveCases} showToast={showToast}/>}
          {tab==="closing"  && <ClosingTab  month={month} props={props} staffList={staffList} cleanData={cleanData} monthCntData={monthCntData} cases={cases} cfg={cfg} saveCfg={saveCfg} showToast={showToast}/>}
          {tab==="cfg"      && <CfgTab      props={props} saveProps={saveProps} staffList={staffList} saveStaff={saveStaff} cfg={cfg} saveCfg={saveCfg} password={password} savePassword={savePassword} showToast={showToast}/>}
        </>}
      </div>
    </div>
  );
}

// 日常清掃タブ
function CleaningTab({month,props,staffList,cleanData,saveClean,monthCntData,saveMonthCnt,carryOver}) {
  const getMc = pid => monthCntData[mcKey(month, pid)] ?? (props.find(p=>p.id===pid)?.cnt || 0);
  const getC  = (pid,st) => Number(cleanData[cdKey(month,pid,st)] || 0);

  const setMc = useCallback(async(pid, num) => {
    await saveMonthCnt({...monthCntData, [mcKey(month, pid)]: num});
  }, [month, monthCntData, saveMonthCnt]);

  const setC = useCallback(async(pid, st, num) => {
    await saveClean({...cleanData, [cdKey(month,pid,st)]: num});
  }, [month, cleanData, saveClean]);

  // 物件ごとのスタッフ売上（月額按分）
  const getPropStaffSales = useCallback((p) => {
    const mc = getMc(p.id);
    const counts = {};
    stNames(staffList).forEach(st => counts[st] = getC(p.id, st));
    return calcStaffSales(p.fee, mc, counts, stNames(staffList));
  }, [month, props, staffList, cleanData, monthCntData, staffList]);

  const stTotal = st => props.reduce((s,p) => {
    const sales = getPropStaffSales(p);
    return s + (sales[stNames(staffList).indexOf(st)] || 0);
  }, 0);
  const grand = stNames(staffList).reduce((s,st) => s + stTotal(st), 0);

  return (
    <div style={{animation:"fadeUp .3s ease"}}>
      <div style={S.ctrlRow}>
        <button style={S.redBtn} onClick={carryOver}>📋 翌月コピー</button>
      </div>
      <div style={S.staffBar}>
        {stNames(staffList).map(st=>(
          <div key={st} style={S.staffCell}>
            <div style={S.staffLabel}>{st}</div>
            <div style={S.staffAmt}>{yen(stTotal(st))}</div>
          </div>
        ))}
        <div style={{...S.staffCell,background:"#c0392b",border:"none"}}>
          <div style={{...S.staffLabel,color:"rgba(255,255,255,0.7)"}}>合計</div>
          <div style={{...S.staffAmt,color:"#fff"}}>{yen(grand)}</div>
        </div>
      </div>
      <div style={S.tableWrap}>
        <table>
          <thead>
            <tr>
              <th style={{textAlign:"left",minWidth:110}}>物件名</th>
              <th>月額</th>
              <th>月回数<br/><span style={{fontSize:9,color:"#f88"}}>今月</span></th>
              {stNames(staffList).map(st=><th key={st} style={{color:"#c44"}}>{st}<br/>回数</th>)}
              {stNames(staffList).map(st=><th key={st+"$"} style={{color:"#2d6a4f"}}>{st}<br/>売上</th>)}
              <th>物件計</th>
            </tr>
          </thead>
          <tbody>
            {props.map(p => {
              const mc = getMc(p.id);
              const sales = getPropStaffSales(p);
              const totalStaffCnt = staffList.reduce((s,st)=>s+getC(p.id,st),0);
              const propSalesTotal = sales.reduce((a,b)=>a+b,0);
              return (
                <tr key={p.id}>
                  <td style={{textAlign:"left",fontSize:11,fontWeight:500}}>{p.name}</td>
                  <td>{yen(p.fee)}</td>
                  <td>
                    <NumInput value={mc} onCommit={num=>setMc(p.id,num)} min={1}
                      style={{width:44,textAlign:"center",padding:"4px 2px"}}/>
                  </td>
                  {stNames(staffList).map(st=>(
                    <td key={st}>
                      <NumInput value={getC(p.id,st)} onCommit={num=>setC(p.id,st,num)} min={0}
                        style={{width:44,textAlign:"center",padding:"4px 2px"}}/>
                    </td>
                  ))}
                  {sales.map((s,i)=>(
                    <td key={staffList[i]+"$"} style={{fontWeight:600,color:"#2d6a4f"}}>{yen(s)}</td>
                  ))}
                  <td style={{fontWeight:700,color: totalStaffCnt===mc&&mc>0?"#2d6a4f":"#333"}}>{yen(propSalesTotal)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{background:"#fff5f5"}}>
              <td style={{textAlign:"left",fontWeight:700}} colSpan={3}>合計</td>
              {stNames(staffList).map(st=><td key={st}/>)}
              {stNames(staffList).map(st=><td key={st+"$"} style={{fontWeight:700,color:"#c44"}}>{yen(stTotal(st))}</td>)}
              <td style={{fontWeight:700}}>{yen(grand)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p style={{fontSize:10,color:"#aaa",marginTop:8,textAlign:"center"}}>物件計が緑色＝担当回数合計が月回数と一致</p>
    </div>
  );
}

// 案件タブ
function CasesTab({month,cases,staffList,saveCases,showToast}) {
  const blank=()=>({date:toDay(),name:"",staff:staffList[0]||"",payment:"現金",amount:""});
  const [form,setForm]=useState(blank());
  const [editId,setEditId]=useState(null);
  const filtered=useMemo(()=>cases.filter(c=>c.date.startsWith(month)).sort((a,b)=>b.date.localeCompare(a.date)),[cases,month]);
  const total=filtered.reduce((s,c)=>s+c.amount,0);
  const cashT=filtered.filter(c=>c.payment==="現金").reduce((s,c)=>s+c.amount,0);
  const xferT=filtered.filter(c=>c.payment==="振込").reduce((s,c)=>s+c.amount,0);
  const handleSave=async()=>{
    if(!form.date||!form.name||!form.amount){showToast("⚠ 日付・名前・金額は必須");return;}
    const amt=Number(form.amount); if(!amt){showToast("⚠ 金額を入力してください");return;}
    if(editId){
      await saveCases(cases.map(c=>c.id===editId?{...form,id:editId,amount:amt}:c));
      setEditId(null);showToast("✅ 更新しました");
    } else {
      await saveCases([{...form,id:Date.now(),amount:amt},...cases]);
      showToast("✅ 保存しました");
    }
    setForm(blank());
  };
  const startEdit=c=>{setForm({...c,amount:String(c.amount)});setEditId(c.id);};
  const del=async id=>{if(!confirm("削除しますか？"))return;await saveCases(cases.filter(c=>c.id!==id));showToast("🗑 削除しました");};
  return (
    <div style={{animation:"fadeUp .3s ease"}}>
      <div style={S.pills}>
        <Pill label="合計" val={yen(total)} red/><Pill label="💴現金" val={yen(cashT)}/><Pill label="🏦振込" val={yen(xferT)}/>
      </div>
      <div style={S.formCard}>
        <div style={S.formTitle}>{editId?"✏️ 編集":"➕ 案件を追加"}</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}>
          <FR label="日付"><input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></FR>
          <FR label="案件名"><input type="text" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="林田様 カーテン設置"/></FR>
          <FR label="担当"><select value={form.staff} onChange={e=>setForm({...form,staff:e.target.value})}>{staffList.map(s=><option key={s}>{s}</option>)}</select></FR>
          <FR label="支払">
            <div style={{display:"flex",gap:8}}>
              {["現金","振込"].map(p=>(
                <button key={p} style={{...S.seg,...(form.payment===p?(p==="現金"?S.segCash:S.segXfer):{})}} onClick={()=>setForm({...form,payment:p})}>
                  {p==="現金"?"💴 現金":"🏦 振込"}
                </button>
              ))}
            </div>
          </FR>
          <FR label="金額（円）">
            <input type="text" inputMode="numeric" value={form.amount}
              onChange={e=>{if(/^\d*$/.test(e.target.value))setForm({...form,amount:e.target.value});}}
              onFocus={e=>e.target.select()} placeholder="15000" style={{width:"100%"}}/>
          </FR>
        </div>
        <div style={{display:"flex",gap:8,marginTop:4}}>
          {editId&&<button style={S.cancelBtn} onClick={()=>{setEditId(null);setForm(blank());}}>キャンセル</button>}
          <button style={S.saveBtn} onClick={handleSave}>{editId?"更新":"保存"}</button>
        </div>
      </div>
      <div style={S.tableWrap}>
        {filtered.length===0?<div style={S.empty}>この月の案件はありません</div>:(
          <table>
            <thead><tr><th>日付</th><th>案件名</th><th>担当</th><th>支払</th><th>金額</th><th></th></tr></thead>
            <tbody>
              {filtered.map(c=>(
                <tr key={c.id}>
                  <td style={{whiteSpace:"nowrap"}}>{c.date}</td>
                  <td style={{textAlign:"left"}}>{c.name}</td>
                  <td>{c.staff}</td>
                  <td><span style={{...S.badge,...(c.payment==="現金"?S.bCash:S.bXfer)}}>{c.payment}</span></td>
                  <td style={{fontWeight:700,color:"#2d6a4f"}}>{yen(c.amount)}</td>
                  <td><button style={S.iconBtn} onClick={()=>startEdit(c)}>✏</button><button style={{...S.iconBtn,color:"#ddd"}} onClick={()=>del(c.id)}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// 月末締めタブ
function ClosingTab({month,props,staffList,cleanData,monthCntData,cases,cfg,saveCfg,showToast}) {
  const [loc,setLoc]=useState(cfg);
  useEffect(()=>setLoc(cfg),[cfg]);

  const getMc = pid => monthCntData[mcKey(month, pid)] ?? (props.find(p=>p.id===pid)?.cnt || 0);
  const getC  = (pid,st) => Number(cleanData[cdKey(month,pid,st)] || 0);

  const cleanBySt = useMemo(()=>{
    const m={};
    staffList.forEach(st=>{ m[st]=0; });
    props.forEach(p => {
      const mc = getMc(p.id);
      const snames = stNames(staffList);
      const counts = {};
      snames.forEach(st => counts[st] = getC(p.id, st));
      const sales = calcStaffSales(p.fee, mc, counts, snames);
      snames.forEach((st,i) => { m[st] = (m[st]||0) + sales[i]; });
    });
    return m;
  },[month,props,cleanData,monthCntData,staffList,staffList]);

  const caseBySt=useMemo(()=>{
    const filt=cases.filter(c=>c.date.startsWith(month));const m={};
    stNames(staffList).forEach(st=>{m[st]={cash:0,xfer:0};});
    filt.forEach(c=>{if(!m[c.staff])m[c.staff]={cash:0,xfer:0};if(c.payment==="現金")m[c.staff].cash+=c.amount;else m[c.staff].xfer+=c.amount;});
    return m;
  },[month,cases,staffList]);

  const stSales=useMemo(()=>{const m={};stNames(staffList).forEach(st=>{m[st]=(cleanBySt[st]||0)+(caseBySt[st]?.cash||0)+(caseBySt[st]?.xfer||0);});return m;},[cleanBySt,caseBySt,staffList]);
  const total=stNames(staffList).reduce((s,st)=>s+(stSales[st]||0),0);
  // 控除対象スタッフのみで按分計算
  const taxTargetNames=stNames(staffList).filter(st=>stTaxTarget(staffList,st));
  const taxTargetTotal=taxTargetNames.reduce((s,st)=>s+(stSales[st]||0),0);
  const cleanTotal=staffList.reduce((s,st)=>s+(cleanBySt[st]||0),0);
  const cashT=cases.filter(c=>c.date.startsWith(month)&&c.payment==="現金").reduce((s,c)=>s+c.amount,0);
  // 振込 = 案件振込 + 日常清掃（全部振込扱い）
  const xferT=cases.filter(c=>c.date.startsWith(month)&&c.payment==="振込").reduce((s,c)=>s+c.amount,0) + cleanTotal;
  const fixPct=total>0?(loc.fixedCost/total*100).toFixed(1):0;
  const taxAmt=Math.round(total*loc.taxRate/100);
  const deduct=loc.fixedCost+taxAmt;
  const remain=total-deduct;
  const remPct=total>0?(remain/total*100).toFixed(1):0;
  const salaries=useMemo(()=>{
    const m={};
    stNames(staffList).forEach(st=>{
      if(stTaxTarget(staffList,st)){
        m[st]=taxTargetTotal>0?Math.round(remain*(stSales[st]||0)/taxTargetTotal):0;
      } else {
        m[st]=null; // 控除対象外
      }
    });
    return m;
  },[remain,stSales,taxTargetTotal,staffList]);

  return (
    <div style={{animation:"fadeUp .3s ease"}}>
      <div style={{...S.card,background:"linear-gradient(135deg,#7a0000,#c0392b)",color:"#fff",marginBottom:12}}>
        <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>📊 月末締め計算表 — {month}</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
          {stNames(staffList).map(st=>(
            <div key={st} style={S.closingCard}>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.6)",marginBottom:2}}>{st}売上</div>
              <div style={{fontWeight:700,fontSize:15}}>{yen(stSales[st]||0)}</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.45)",marginTop:2}}>清掃 {yen(cleanBySt[st]||0)} / 案件 {yen((caseBySt[st]?.cash||0)+(caseBySt[st]?.xfer||0))}</div>
            </div>
          ))}
        </div>
        <div style={{display:"flex",gap:16,borderTop:"1px solid rgba(255,255,255,0.2)",paddingTop:10,flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.6)"}}>🏦 振込合計</div>
            <b>{yen(xferT)}</b>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.45)"}}>清掃 {yen(cleanTotal)} + 案件 {yen(xferT-cleanTotal)}</div>
          </div>
          <div><div style={{fontSize:10,color:"rgba(255,255,255,0.6)"}}>💴 現金（案件）</div><b>{yen(cashT)}</b></div>
          <div style={{marginLeft:"auto"}}><div style={{fontSize:10,color:"rgba(255,255,255,0.6)"}}>月売上合計</div><b style={{fontSize:22}}>{yen(total)}</b></div>
        </div>
      </div>
      <div style={{...S.card,marginBottom:12}}>
        <div style={S.sTitle}>控除設定</div>
        <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:10}}>
          <FR label="固定費（円）"><NumInput value={loc.fixedCost} onCommit={v=>setLoc({...loc,fixedCost:v})} style={{width:130}}/></FR>
          <FR label="税貯金率（%）"><NumInput value={loc.taxRate} onCommit={v=>setLoc({...loc,taxRate:v})} style={{width:90}}/></FR>
        </div>
        <button style={{...S.saveBtn,width:"auto",padding:"8px 20px",fontSize:13}} onClick={async()=>{await saveCfg(loc);showToast("✅ 設定を保存しました");}}>保存</button>
      </div>
      <div style={{...S.card,marginBottom:12}}>
        <div style={S.sTitle}>控除内訳</div>
        <DRow label="固定費" note={fixPct+"%"} amt={loc.fixedCost}/>
        <DRow label="税貯金" note={loc.taxRate+"%"} amt={taxAmt}/>
        <div style={{borderTop:"2px solid #eee",marginTop:8,paddingTop:8,display:"flex",justifyContent:"space-between"}}>
          <b>控除合計（{(Number(fixPct)+Number(loc.taxRate)).toFixed(1)}%）</b>
          <span style={{color:"#c0392b",fontWeight:700}}>-{yen(deduct)}</span>
        </div>
        <div style={{background:"#f0fdf4",borderRadius:10,padding:"10px 14px",marginTop:8,display:"flex",justifyContent:"space-between"}}>
          <span style={{fontWeight:700,color:"#2d6a4f"}}>残額（{remPct}%）</span>
          <span style={{fontWeight:700,color:"#2d6a4f",fontSize:18}}>{yen(remain)}</span>
        </div>
      </div>
      <div style={S.card}>
        <div style={S.sTitle}>給与按分（売上比率で自動計算）</div>
        {stNames(staffList).map(st=>{
          const isTarget = stTaxTarget(staffList,st);
          const ratio=taxTargetTotal>0&&isTarget?((stSales[st]||0)/taxTargetTotal*100).toFixed(1):0;
          return (
            <div key={st} style={{marginBottom:14,opacity:isTarget?1:0.7}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,alignItems:"center"}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontWeight:700}}>👤 {st}給与</span>
                  {!isTarget&&<span style={{fontSize:10,background:"#f0ece4",color:"#888",borderRadius:4,padding:"1px 6px"}}>固定費に含む</span>}
                </div>
                <div style={{textAlign:"right"}}>
                  {isTarget
                    ? <><span style={{fontSize:11,color:"#aaa",marginRight:8}}>売上比 {ratio}%</span>
                        <span style={{fontWeight:700,fontSize:16,color:"#2d6a4f"}}>{yen(salaries[st]||0)}</span></>
                    : <span style={{fontSize:13,color:"#aaa"}}>按分対象外</span>
                  }
                </div>
              </div>
              {isTarget&&<div style={S.barBg}><div style={{...S.bar,width:ratio+"%"}}/></div>}
              <div style={{fontSize:10,color:"#aaa",marginTop:3}}>清掃 {yen(cleanBySt[st]||0)} ／ 案件現金 {yen(caseBySt[st]?.cash||0)} ／ 案件振込 {yen(caseBySt[st]?.xfer||0)}</div>
            </div>
          );
        })}
        <div style={{borderTop:"2px solid #eee",paddingTop:10,display:"flex",justifyContent:"space-between"}}>
          <b>給与合計（按分対象）</b><b>{yen(taxTargetNames.reduce((s,st)=>s+(salaries[st]||0),0))}</b>
        </div>
        <p style={{fontSize:10,color:"#bbb",marginTop:6}}>※荒牧さん給与は固定費に含む　※山辺ボーナスはねこのて給与から支払い</p>
      </div>
    </div>
  );
}

// 設定タブ
function CfgTab({props,saveProps,staffList,saveStaff,cfg,saveCfg,password,savePassword,showToast}) {
  const [lProps,setLProps]=useState(props); useEffect(()=>setLProps(props),[props]);
  const [lStaff,setLStaff]=useState(staffList.map(s=>typeof s==="string"?{name:s,taxTarget:true}:s)); 
  useEffect(()=>setLStaff(staffList.map(s=>typeof s==="string"?{name:s,taxTarget:true}:s)),[staffList]);
  const [lCfg,setLCfg]=useState(cfg); useEffect(()=>setLCfg(cfg),[cfg]);
  const updProp=(id,k,v)=>setLProps(lProps.map(p=>p.id===id?{...p,[k]:k==="name"?v:Number(v)}:p));
  const addProp=()=>setLProps([...lProps,{id:Date.now(),name:"",fee:0,cnt:1}]);
  const delProp=id=>{if(!confirm("削除しますか？"))return;setLProps(lProps.filter(p=>p.id!==id));};
  const delStaff=i=>{if(!confirm("削除しますか？"))return;const a=[...lStaff];a.splice(i,1);setLStaff(a);};
  const updStaffName=(i,v)=>{const a=[...lStaff];a[i]={...a[i],name:v};setLStaff(a);};
  const toggleTaxTarget=(i)=>{const a=[...lStaff];a[i]={...a[i],taxTarget:!a[i].taxTarget};setLStaff(a);};
  const saveAll=async()=>{await saveProps(lProps);await saveStaff(lStaff.filter(s=>s.name&&s.name.trim()));await saveCfg(lCfg);showToast("✅ 保存しました");};
  return (
    <div style={{animation:"fadeUp .3s ease"}}>
      <div style={{...S.card,marginBottom:12}}>
        <div style={S.sTitle}>👥 スタッフ管理</div>
        {lStaff.map((s,i)=>(
          <div key={i} style={{display:"flex",gap:8,marginBottom:10,alignItems:"center",background:"#faf8f5",borderRadius:10,padding:"8px 10px"}}>
            <input type="text" value={s.name||""} onChange={e=>updStaffName(i,e.target.value)} placeholder="スタッフ名" style={{flex:1}}/>
            <div style={{display:"flex",alignItems:"center",gap:6,whiteSpace:"nowrap"}}>
              <span style={{fontSize:11,color:"#888"}}>控除対象</span>
              <button onClick={()=>toggleTaxTarget(i)} style={{
                width:42,height:24,borderRadius:12,border:"none",cursor:"pointer",
                background:s.taxTarget!==false?"#2d6a4f":"#ccc",
                position:"relative",transition:"background .2s"
              }}>
                <span style={{
                  position:"absolute",top:3,left:s.taxTarget!==false?20:3,
                  width:18,height:18,borderRadius:"50%",background:"#fff",transition:"left .2s"
                }}/>
              </button>
            </div>
            <button style={{...S.iconBtn,color:"#e74c3c",fontSize:16}} onClick={()=>delStaff(i)}>✕</button>
          </div>
        ))}
        <button style={S.cancelBtn} onClick={()=>setLStaff([...lStaff,{name:"",taxTarget:true}])}>＋ スタッフを追加</button>
      </div>
      <div style={{...S.card,marginBottom:12}}>
        <div style={S.sTitle}>🏠 物件マスタ（デフォルト月回数）</div>
        <p style={{fontSize:11,color:"#aaa",marginBottom:10}}>月ごとの回数は日常清掃タブで変更できます</p>
        <div style={S.tableWrap}>
          <table>
            <thead><tr><th style={{textAlign:"left"}}>物件名</th><th>月額(円)</th><th>標準月回数</th><th></th></tr></thead>
            <tbody>
              {lProps.map(p=>(
                <tr key={p.id}>
                  <td><input type="text" value={p.name} onChange={e=>updProp(p.id,"name",e.target.value)} style={{width:"100%"}}/></td>
                  <td><NumInput value={p.fee} onCommit={v=>updProp(p.id,"fee",v)} style={{width:90}}/></td>
                  <td><NumInput value={p.cnt} onCommit={v=>updProp(p.id,"cnt",Math.max(1,v))} min={1} style={{width:60}}/></td>
                  <td><button style={{...S.iconBtn,color:"#e74c3c"}} onClick={()=>delProp(p.id)}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button style={{...S.cancelBtn,marginTop:10}} onClick={addProp}>＋ 物件を追加</button>
      </div>
      <div style={{...S.card,marginBottom:12}}>
        <div style={S.sTitle}>⚙️ 固定設定</div>
        <FR label="固定費（円）"><NumInput value={lCfg.fixedCost} onCommit={v=>setLCfg({...lCfg,fixedCost:v})} style={{width:140}}/></FR>
        <FR label="税貯金率（%）"><NumInput value={lCfg.taxRate} onCommit={v=>setLCfg({...lCfg,taxRate:v})} style={{width:100}}/></FR>
      </div>
      <button style={S.saveBtn} onClick={saveAll}>💾 すべて保存</button>
      <PwChangeCard password={password} savePassword={savePassword} showToast={showToast}/>
    </div>
  );
}

function PwChangeCard({password,savePassword,showToast}) {
  const [cur,setCur]=useState(""); const [next,setNext]=useState(""); const [confirm,setConfirm]=useState("");
  const change = async () => {
    if(cur !== password){showToast("⚠ 現在のパスワードが違います");return;}
    if(!next){showToast("⚠ 新しいパスワードを入力してください");return;}
    if(next !== confirm){showToast("⚠ 確認用パスワードが一致しません");return;}
    await savePassword(next);
    setCur(""); setNext(""); setConfirm("");
    showToast("✅ パスワードを変更しました");
  };
  return (
    <div style={{...S.card,marginTop:12,border:"1.5px solid #fcc"}}>
      <div style={S.sTitle}>🔑 パスワード変更</div>
      <FR label="現在のパスワード"><input type="password" value={cur} onChange={e=>setCur(e.target.value)} placeholder="現在のパスワード"/></FR>
      <FR label="新しいパスワード"><input type="password" value={next} onChange={e=>setNext(e.target.value)} placeholder="新しいパスワード"/></FR>
      <FR label="新しいパスワード（確認）"><input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="もう一度入力"/></FR>
      <button style={{...S.saveBtn,background:"linear-gradient(135deg,#1a3a6e,#4a6fa5)"}} onClick={change}>🔑 パスワードを変更</button>
    </div>
  );
}

function FR({label,children}){return <div style={{marginBottom:10}}><div style={{fontSize:11,color:"#999",marginBottom:4}}>{label}</div>{children}</div>;}
function Pill({label,val,red}){return <div style={{background:red?"#c0392b":"#f5eeee",color:red?"#fff":"#777",borderRadius:20,padding:"5px 14px",fontSize:12,fontWeight:600}}>{label}：{val}</div>;}
function DRow({label,note,amt}){return <div style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid #f5eeee",fontSize:13}}><span style={{color:"#666"}}>{label} <span style={{color:"#bbb",fontSize:11}}>({note})</span></span><span style={{color:"#c0392b",fontWeight:600}}>-{yen(amt)}</span></div>;}

const css=`
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#fdf8f5;font-family:'Noto Sans JP',sans-serif;-webkit-tap-highlight-color:transparent}
  input,select,button,textarea{font-family:'Noto Sans JP',sans-serif}
  input[type=text],input[type=date],input[type=month],select{
    border:1.5px solid #e0d0d0;border-radius:8px;padding:7px 10px;
    background:#fff;font-size:13px;color:#333;outline:none;transition:border-color .2s;width:100%}
  input[type=text]:focus,input[type=date]:focus,select:focus{border-color:#c0392b}
  ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#ddd;border-radius:4px}
  table{border-collapse:collapse;width:100%}
  th{background:#fff5f5;font-size:11px;font-weight:700;color:#c44;padding:8px 6px;text-align:center;white-space:nowrap;position:sticky;top:0;z-index:2;border-bottom:2px solid #fcc}
  td{padding:7px 6px;border-bottom:1px solid #f5eeee;font-size:12px;text-align:center}
  tr:hover td{background:#fff8f8}
  @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  @keyframes rise{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
  @keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}}
  @keyframes toastAnim{0%{opacity:0;transform:translateX(-50%) translateY(10px)}15%{opacity:1;transform:translateX(-50%) translateY(0)}85%{opacity:1}100%{opacity:0}}
`;

const S={
  loginBg:{minHeight:"100vh",background:"radial-gradient(ellipse at 50% 40%,#3a0808,#1a0505)",display:"flex",alignItems:"center",justifyContent:"center"},
  loginCard:{background:"rgba(28,8,8,0.95)",border:"1px solid #551111",borderRadius:20,padding:"44px 36px",display:"flex",flexDirection:"column",alignItems:"center",gap:12,minWidth:300},
  loginIcon:{fontSize:56,marginBottom:4},
  loginTitle:{fontSize:20,fontWeight:700,color:"#fff",letterSpacing:2},
  loginSub:{fontSize:11,color:"#884444",marginBottom:8},
  loginInput:{width:"100%",padding:"12px 16px",borderRadius:10,border:"1.5px solid #441111",background:"rgba(80,20,20,0.5)",color:"#fff",fontSize:15,outline:"none",textAlign:"center",letterSpacing:4},
  loginBtn:{width:"100%",padding:"13px 0",background:"linear-gradient(135deg,#a00,#e03)",color:"#fff",border:"none",borderRadius:10,fontSize:15,fontWeight:700,cursor:"pointer",marginTop:4},
  app:{minHeight:"100vh",background:"#fdf8f5"},
  header:{background:"linear-gradient(135deg,#7a0000,#c0392b)",color:"#fff",padding:"12px 16px",display:"flex",alignItems:"center",gap:8},
  hTitle:{fontWeight:700,fontSize:15,color:"#fff"},
  hSub:{fontSize:10,color:"rgba(255,255,255,0.6)"},
  logoutBtn:{background:"rgba(255,255,255,0.15)",border:"none",color:"rgba(255,255,255,0.7)",borderRadius:8,padding:"5px 12px",fontSize:11,cursor:"pointer"},
  tabs:{display:"flex",background:"#fff",borderBottom:"2px solid #fde8e8",overflowX:"auto"},
  tab:{flex:1,padding:"12px 6px",background:"none",border:"none",fontSize:12,color:"#bbb",cursor:"pointer",fontWeight:500,whiteSpace:"nowrap",minWidth:70},
  tabOn:{color:"#c0392b",borderBottom:"3px solid #e03030",fontWeight:700,background:"#fff8f8"},
  body:{padding:14,maxWidth:860,margin:"0 auto"},
  ctrlRow:{display:"flex",gap:10,alignItems:"center",marginBottom:12,flexWrap:"wrap"},
  pills:{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"},
  staffBar:{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"},
  staffCell:{flex:1,minWidth:100,background:"#fff5f5",borderRadius:10,padding:"10px 12px",border:"1px solid #fcc"},
  staffLabel:{fontSize:11,color:"#c44",marginBottom:3},
  staffAmt:{fontWeight:700,color:"#8b0000",fontSize:14},
  tableWrap:{background:"#fff",borderRadius:12,overflow:"auto",boxShadow:"0 2px 8px rgba(180,0,0,0.07)"},
  card:{background:"#fff",borderRadius:14,padding:16,boxShadow:"0 2px 8px rgba(180,0,0,0.07)",marginBottom:4},
  formCard:{background:"#fff",borderRadius:14,padding:16,boxShadow:"0 2px 8px rgba(180,0,0,0.07)",marginBottom:12},
  formTitle:{fontWeight:700,fontSize:14,color:"#8b0000",marginBottom:12},
  seg:{flex:1,padding:"8px 0",background:"#f5f5f5",border:"1.5px solid #ddd",borderRadius:8,fontSize:12,cursor:"pointer",color:"#888"},
  segCash:{background:"#fef9c3",borderColor:"#f0b429",color:"#7a4f00",fontWeight:700},
  segXfer:{background:"#dbeafe",borderColor:"#3b82f6",color:"#1e3a8a",fontWeight:700},
  saveBtn:{width:"100%",padding:"12px 0",background:"linear-gradient(135deg,#7a0000,#c0392b)",color:"#fff",border:"none",borderRadius:10,fontSize:14,fontWeight:700,cursor:"pointer"},
  cancelBtn:{padding:"10px 18px",background:"#f5f5f5",border:"1.5px solid #ddd",borderRadius:10,fontSize:13,cursor:"pointer",color:"#666"},
  redBtn:{padding:"8px 16px",background:"#fff0f0",border:"1.5px solid #f9a8a8",borderRadius:8,fontSize:12,cursor:"pointer",color:"#c0392b",fontWeight:600},
  badge:{display:"inline-block",borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700},
  bCash:{background:"#fef9c3",color:"#7a4f00"},
  bXfer:{background:"#dbeafe",color:"#1e3a8a"},
  iconBtn:{background:"none",border:"none",cursor:"pointer",fontSize:13,padding:"2px 5px",color:"#c88"},
  empty:{textAlign:"center",color:"#ccc",padding:40,fontSize:13},
  sTitle:{fontWeight:700,fontSize:14,color:"#8b0000",marginBottom:12},
  closingCard:{flex:1,minWidth:110,background:"rgba(255,255,255,0.15)",borderRadius:10,padding:"10px 12px"},
  barBg:{height:8,background:"#fee",borderRadius:8,overflow:"hidden"},
  bar:{height:"100%",borderRadius:8,background:"linear-gradient(90deg,#c0392b,#e74c3c)",transition:"width .5s"},
  toast:{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:"#7a0000",color:"#fff",borderRadius:12,padding:"12px 24px",fontSize:13,fontWeight:600,zIndex:999,animation:"toastAnim 2.5s ease forwards",whiteSpace:"nowrap",boxShadow:"0 4px 20px rgba(180,0,0,0.4)"},
};
