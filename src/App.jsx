import { useState, useEffect, useMemo, useCallback } from "react";
import { dbGet, dbSet } from "./firebase";

const PASSWORD = "nekono2024";
const SK = { properties:"props", cases:"cases", cleaning:"clean", settings:"cfg", staff:"staff" };
const DEFAULT_STAFF = ["公文","広田","ねこのて"];
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
function Login({onLogin}) {
  const [pw,setPw]=useState(""); const [err,setErr]=useState(false); const [shake,setShake]=useState(false);
  const go=()=>{ if(pw===PASSWORD) onLogin(); else {setErr(true);setShake(true);setTimeout(()=>setShake(false),500);}};
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
  const [cleanData,setCleanData]=useState({});
  const [cases,setCases]=useState([]);
  const [cfg,setCfg]=useState(DEFAULT_CFG);
  const [toast,setToast]=useState("");
  const [loading,setLoading]=useState(true);

  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(""),2500); };

  useEffect(()=>{
    if(!authed)return;
    (async()=>{
      const [p,cl,ca,c,sf] = await Promise.all([
        dbGet(SK.properties), dbGet(SK.cleaning), dbGet(SK.cases), dbGet(SK.settings), dbGet(SK.staff)
      ]);
      if(p)setProps(p); if(cl)setCleanData(cl); if(ca)setCases(ca); if(c)setCfg(c); if(sf)setStaffList(sf);
      setLoading(false);
    })();
  },[authed]);

  const saveProps  = async v => { setProps(v);     await dbSet(SK.properties, v); };
  const saveClean  = async v => { setCleanData(v); await dbSet(SK.cleaning,   v); };
  const saveCases  = async v => { setCases(v);     await dbSet(SK.cases,      v); };
  const saveCfg    = async v => { setCfg(v);       await dbSet(SK.settings,   v); };
  const saveStaff  = async v => { setStaffList(v); await dbSet(SK.staff,      v); };

  const carryOver = async () => {
    const nm = nextMo(month);
    const d = {...cleanData};
    props.forEach(p => staffList.forEach(s => { const k=`${nm}-${p.id}-${s}`; if(!(k in d)) d[k]=0; }));
    await saveClean(d); setMonth(nm); showToast(`✅ ${nm} にコピーしました`);
  };

  if(!authed) return <Login onLogin={()=>setAuthed(true)}/>;

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
          {tab==="cleaning" && <CleaningTab month={month} props={props} staffList={staffList} cleanData={cleanData} saveClean={saveClean} carryOver={carryOver}/>}
          {tab==="cases"    && <CasesTab    month={month} cases={cases} staffList={staffList} saveCases={saveCases} showToast={showToast}/>}
          {tab==="closing"  && <ClosingTab  month={month} props={props} staffList={staffList} cleanData={cleanData} cases={cases} cfg={cfg} saveCfg={saveCfg} showToast={showToast}/>}
          {tab==="cfg"      && <CfgTab      props={props} saveProps={saveProps} staffList={staffList} saveStaff={saveStaff} cfg={cfg} saveCfg={saveCfg} showToast={showToast}/>}
        </>}
      </div>
    </div>
  );
}

// 日常清掃タブ
function CleaningTab({month,props,staffList,cleanData,saveClean,carryOver}) {
  const up  = p => p.cnt>0 ? Math.floor(p.fee/p.cnt) : 0;
  const getC = (pid,st) => Number(cleanData[`${month}-${pid}-${st}`]||0);
  const setC = useCallback(async(pid,st,num)=>{
    await saveClean({...cleanData,[`${month}-${pid}-${st}`]:num});
  },[month,cleanData,saveClean]);
  const stTotal = st => props.reduce((s,p)=>s+up(p)*getC(p.id,st),0);
  const pTotal  = p  => staffList.reduce((s,st)=>s+up(p)*getC(p.id,st),0);
  const grand   = staffList.reduce((s,st)=>s+stTotal(st),0);
  return (
    <div style={{animation:"fadeUp .3s ease"}}>
      <div style={S.ctrlRow}>
        <button style={S.redBtn} onClick={carryOver}>📋 翌月コピー</button>
      </div>
      <div style={S.staffBar}>
        {staffList.map(st=>(
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
              <th>月額</th><th>回数</th><th>単価</th>
              {staffList.map(st=><th key={st} style={{color:"#c44"}}>{st}<br/>回数</th>)}
              {staffList.map(st=><th key={st+"$"} style={{color:"#2d6a4f"}}>{st}<br/>売上</th>)}
              <th>物件計</th>
            </tr>
          </thead>
          <tbody>
            {props.map(p=>{
              const u=up(p);
              return (
                <tr key={p.id}>
                  <td style={{textAlign:"left",fontSize:11,fontWeight:500}}>{p.name}</td>
                  <td>{yen(p.fee)}</td><td>{p.cnt}</td><td style={{color:"#888"}}>{yen(u)}</td>
                  {staffList.map(st=>(
                    <td key={st}>
                      <NumInput value={getC(p.id,st)} onCommit={num=>setC(p.id,st,num)} min={0} style={{width:44,textAlign:"center",padding:"4px 2px"}}/>
                    </td>
                  ))}
                  {staffList.map(st=>(
                    <td key={st+"$"} style={{fontWeight:600,color:"#2d6a4f"}}>{yen(u*getC(p.id,st))}</td>
                  ))}
                  <td style={{fontWeight:700}}>{yen(pTotal(p))}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{background:"#fff5f5"}}>
              <td style={{textAlign:"left",fontWeight:700}} colSpan={4}>合計</td>
              {staffList.map(st=><td key={st}/>)}
              {staffList.map(st=><td key={st+"$"} style={{fontWeight:700,color:"#c44"}}>{yen(stTotal(st))}</td>)}
              <td style={{fontWeight:700}}>{yen(grand)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
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
function ClosingTab({month,props,staffList,cleanData,cases,cfg,saveCfg,showToast}) {
  const [loc,setLoc]=useState(cfg);
  useEffect(()=>setLoc(cfg),[cfg]);
  const up=p=>p.cnt>0?Math.floor(p.fee/p.cnt):0;
  const getC=(pid,st)=>Number(cleanData[`${month}-${pid}-${st}`]||0);
  const cleanBySt=useMemo(()=>{const m={};staffList.forEach(st=>{m[st]=props.reduce((s,p)=>s+up(p)*getC(p.id,st),0);});return m;},[month,props,cleanData,staffList]);
  const caseBySt=useMemo(()=>{
    const filt=cases.filter(c=>c.date.startsWith(month));const m={};
    staffList.forEach(st=>{m[st]={cash:0,xfer:0};});
    filt.forEach(c=>{if(!m[c.staff])m[c.staff]={cash:0,xfer:0};if(c.payment==="現金")m[c.staff].cash+=c.amount;else m[c.staff].xfer+=c.amount;});
    return m;
  },[month,cases,staffList]);
  const stSales=useMemo(()=>{const m={};staffList.forEach(st=>{m[st]=(cleanBySt[st]||0)+(caseBySt[st]?.cash||0)+(caseBySt[st]?.xfer||0);});return m;},[cleanBySt,caseBySt,staffList]);
  const total=staffList.reduce((s,st)=>s+(stSales[st]||0),0);
  const cashT=cases.filter(c=>c.date.startsWith(month)&&c.payment==="現金").reduce((s,c)=>s+c.amount,0);
  const xferT=cases.filter(c=>c.date.startsWith(month)&&c.payment==="振込").reduce((s,c)=>s+c.amount,0);
  const fixPct=total>0?(loc.fixedCost/total*100).toFixed(1):0;
  const taxAmt=Math.round(total*loc.taxRate/100);
  const deduct=loc.fixedCost+taxAmt;
  const remain=total-deduct;
  const remPct=total>0?(remain/total*100).toFixed(1):0;
  const salaries=useMemo(()=>{const m={};staffList.forEach(st=>{m[st]=total>0?Math.round(remain*(stSales[st]||0)/total):0;});return m;},[remain,stSales,total,staffList]);
  return (
    <div style={{animation:"fadeUp .3s ease"}}>
      <div style={{...S.card,background:"linear-gradient(135deg,#7a0000,#c0392b)",color:"#fff",marginBottom:12}}>
        <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>📊 月末締め計算表 — {month}</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
          {staffList.map(st=>(
            <div key={st} style={S.closingCard}>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.6)",marginBottom:2}}>{st}売上</div>
              <div style={{fontWeight:700,fontSize:15}}>{yen(stSales[st]||0)}</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.45)",marginTop:2}}>清掃 {yen(cleanBySt[st]||0)} / 案件 {yen((caseBySt[st]?.cash||0)+(caseBySt[st]?.xfer||0))}</div>
            </div>
          ))}
        </div>
        <div style={{display:"flex",gap:16,borderTop:"1px solid rgba(255,255,255,0.2)",paddingTop:10,flexWrap:"wrap"}}>
          <div><div style={{fontSize:10,color:"rgba(255,255,255,0.6)"}}>🏦 振込</div><b>{yen(xferT)}</b></div>
          <div><div style={{fontSize:10,color:"rgba(255,255,255,0.6)"}}>💴 現金</div><b>{yen(cashT)}</b></div>
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
        {staffList.map(st=>{
          const ratio=total>0?((stSales[st]||0)/total*100).toFixed(1):0;
          return (
            <div key={st} style={{marginBottom:14}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                <span style={{fontWeight:700}}>👤 {st}給与</span>
                <div style={{textAlign:"right"}}>
                  <span style={{fontSize:11,color:"#aaa",marginRight:8}}>売上比 {ratio}%</span>
                  <span style={{fontWeight:700,fontSize:16,color:"#c0392b"}}>{yen(salaries[st]||0)}</span>
                </div>
              </div>
              <div style={S.barBg}><div style={{...S.bar,width:ratio+"%"}}/></div>
              <div style={{fontSize:10,color:"#aaa",marginTop:3}}>清掃 {yen(cleanBySt[st]||0)} ／ 案件現金 {yen(caseBySt[st]?.cash||0)} ／ 案件振込 {yen(caseBySt[st]?.xfer||0)}</div>
            </div>
          );
        })}
        <div style={{borderTop:"2px solid #eee",paddingTop:10,display:"flex",justifyContent:"space-between"}}>
          <b>給与合計</b><b>{yen(staffList.reduce((s,st)=>s+(salaries[st]||0),0))}</b>
        </div>
        <p style={{fontSize:10,color:"#bbb",marginTop:6}}>※荒牧さん給与は固定費に含む　※山辺ボーナスはねこのて給与から支払い</p>
      </div>
    </div>
  );
}

// 設定タブ
function CfgTab({props,saveProps,staffList,saveStaff,cfg,saveCfg,showToast}) {
  const [lProps,setLProps]=useState(props); useEffect(()=>setLProps(props),[props]);
  const [lStaff,setLStaff]=useState(staffList); useEffect(()=>setLStaff(staffList),[staffList]);
  const [lCfg,setLCfg]=useState(cfg); useEffect(()=>setLCfg(cfg),[cfg]);
  const updProp=(id,k,v)=>setLProps(lProps.map(p=>p.id===id?{...p,[k]:k==="name"?v:Number(v)}:p));
  const addProp=()=>setLProps([...lProps,{id:Date.now(),name:"",fee:0,cnt:1}]);
  const delProp=id=>{if(!confirm("削除しますか？"))return;setLProps(lProps.filter(p=>p.id!==id));};
  const delStaff=i=>{if(!confirm("削除しますか？"))return;const a=[...lStaff];a.splice(i,1);setLStaff(a);};
  const saveAll=async()=>{await saveProps(lProps);await saveStaff(lStaff.filter(s=>s.trim()));await saveCfg(lCfg);showToast("✅ 保存しました");};
  return (
    <div style={{animation:"fadeUp .3s ease"}}>
      <div style={{...S.card,marginBottom:12}}>
        <div style={S.sTitle}>👥 スタッフ管理</div>
        {lStaff.map((s,i)=>(
          <div key={i} style={{display:"flex",gap:8,marginBottom:8,alignItems:"center"}}>
            <input type="text" value={s} onChange={e=>{const a=[...lStaff];a[i]=e.target.value;setLStaff(a);}} placeholder="スタッフ名" style={{flex:1}}/>
            <button style={{...S.iconBtn,color:"#e74c3c",fontSize:16}} onClick={()=>delStaff(i)}>✕</button>
          </div>
        ))}
        <button style={S.cancelBtn} onClick={()=>setLStaff([...lStaff,""])}>＋ スタッフを追加</button>
      </div>
      <div style={{...S.card,marginBottom:12}}>
        <div style={S.sTitle}>🏠 物件マスタ</div>
        <div style={S.tableWrap}>
          <table>
            <thead><tr><th style={{textAlign:"left"}}>物件名</th><th>月額(円)</th><th>月回数</th><th></th></tr></thead>
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
