import { useState, useEffect, useMemo, useCallback } from "react";
import { dbGet, dbSet } from "./firebase";

const DEFAULT_PASSWORD = "nekono2024";
const SK = {
  properties:"props", cases:"cases", cleaning:"clean", settings:"cfg",
  staff:"staff", monthcnt:"monthcnt", password:"password",
  jobs:"jobs", customers:"customers",
  stayProps:"stayProps", stayClean:"stayClean", stayMonthCnt:"stayMc",
};
const DEFAULT_STAFF = [{name:"公文",taxTarget:true},{name:"広田",taxTarget:true},{name:"ねこのて",taxTarget:true}];
const DEFAULT_PROPS = [
  {id:1, name:"アメックス長尾ヒルズ", fee:30000, cnt:9},
  {id:2, name:"ティエドール柚須", fee:8000, cnt:4},
  {id:3, name:"グランリヴィエラ", fee:5000, cnt:4},
  {id:4, name:"ラヴィータ美松", fee:10000, cnt:5},
  {id:5, name:"フローレス長尾", fee:10000, cnt:5},
  {id:6, name:"塔原サンハイツ", fee:6600, cnt:1},
  {id:7, name:"ビオニール1", fee:8000, cnt:2},
  {id:8, name:"ホークヒルズ那珂川", fee:2500, cnt:1},
  {id:9, name:"サニーガーデン那珂川", fee:5000, cnt:2},
  {id:10, name:"アプリーレ1", fee:2500, cnt:1},
  {id:11, name:"サニータウン次郎丸", fee:2500, cnt:1},
  {id:12, name:"ホークヒルズ古賀", fee:8000, cnt:4},
  {id:13, name:"ホーユーコンフォルト大濠公", fee:12000, cnt:4},
  {id:14, name:"グレースコート", fee:12000, cnt:2},
  {id:15, name:"第5サンシャイン", fee:25300, cnt:5},
  {id:16, name:"グランドシャルマン", fee:17280, cnt:4},
  {id:17, name:"レクサスガーデン", fee:17600, cnt:4},
  {id:18, name:"サニーガーデン安井野", fee:8800, cnt:5},
  {id:19, name:"アクセス", fee:14000, cnt:2},
  {id:20, name:"鞍山コーポ", fee:4000, cnt:2},
];
// 宿泊清掃物件マスタ初期値（設定タブで追加・編集可）
const DEFAULT_STAY_PROPS = [];

const DEFAULT_CFG = { fixedCost:125000, taxRate:3 };
const STATUS_LIST = ["見込み","見積済","確定","完了","キャンセル"];
const STATUS_COLOR = {
  "見積済":{bg:"#fef9c3",color:"#854d0e",border:"#fde047"},
  "確定": {bg:"#dbeafe",color:"#1e40af",border:"#93c5fd"},
  "完了": {bg:"#dcfce7",color:"#166534",border:"#86efac"},
  "キャンセル":{bg:"#f3f4f6",color:"#6b7280",border:"#d1d5db"},
  "見込み":{bg:"#f3e8ff",color:"#7c3aed",border:"#c4b5fd"},
};
const WEEKDAYS=["日","月","火","水","木","金","土"];
const toStaffObj=s=>typeof s==="string"?{name:s,taxTarget:true}:s;
const stNames=list=>list.map(s=>toStaffObj(s).name);
const isTaxTarget=s=>toStaffObj(s).taxTarget!==false;
const yen=n=>"¥"+Math.round(Number(n)||0).toLocaleString();
const toDay=()=>new Date().toISOString().slice(0,10);
const toMonth=()=>new Date().toISOString().slice(0,7);
const nextMo=ym=>{const [y,m]=ym.split("-").map(Number);return m===12?`${y+1}-01`:`${y}-${String(m+1).padStart(2,"0")}`;};
const mcKey=(month,pid)=>`${month}-cnt-${pid}`;
const cdKey=(month,pid,st)=>`${month}-${pid}-${st}`;
const stGet=async k=>{try{return await dbGet(k)||null;}catch{return null;}};
const stSet=async(k,v)=>{try{await dbSet(k,v);}catch{}};

function calcStaffSales(fee,monthCnt,staffCounts,names){
  if(!monthCnt)return names.map(()=>0);
  const totalCnt=names.reduce((s,st)=>s+(staffCounts[st]||0),0);
  if(!totalCnt)return names.map(()=>0);
  let sales=names.map(st=>Math.floor(fee*(staffCounts[st]||0)/monthCnt));
  const distributed=Math.round(fee*totalCnt/monthCnt);
  const diff=distributed-sales.reduce((a,b)=>a+b,0);
  for(let i=names.length-1;i>=0;i--){if((staffCounts[names[i]]||0)>0){sales[i]+=diff;break;}}
  return sales;
}

// 宿泊清掃用計算：1回単価×回数（按分なし、スタッフ別集計）
function calcStayStaffSales(unitPrice,staffCounts,names){
  return names.map(st=>(unitPrice||0)*(staffCounts[st]||0));
}

function NumInput({value,onCommit,style,min=0}){
  const [local,setLocal]=useState(String(value??""));
  useEffect(()=>setLocal(String(value??"")), [value]);
  return <input type="text" inputMode="numeric" value={local}
    onChange={e=>{if(e.target.value===""||/^-?\d*$/.test(e.target.value))setLocal(e.target.value);}}
    onBlur={()=>{const n=Math.max(min,Number(local)||0);setLocal(String(n));if(onCommit)onCommit(n);}}
    onKeyDown={e=>e.key==="Enter"&&e.target.blur()}
    onFocus={e=>e.target.select()} style={style}/>;
}

function Login({onLogin,password}){
  const [pw,setPw]=useState("");const [err,setErr]=useState(false);const [shake,setShake]=useState(false);
  const go=()=>{if(pw===password)onLogin();else{setErr(true);setShake(true);setTimeout(()=>setShake(false),500);}};
  return <div style={S.loginBg}><style>{css}</style>
    <div style={{...S.loginCard,animation:shake?"shake .4s":"rise .5s ease"}}>
      <div style={S.loginIcon}>🐾</div>
      <div style={S.loginTitle}>便利屋 ねこのて</div>
      <div style={S.loginSub}>売上管理システム</div>
      <input style={{...S.loginInput,borderColor:err?"#ff6b6b":"#441111"}} type="password"
        placeholder="パスワードを入力" value={pw}
        onChange={e=>{setPw(e.target.value);setErr(false);}}
        onKeyDown={e=>e.key==="Enter"&&go()} autoFocus/>
      {err&&<p style={{color:"#ff6b6b",fontSize:12,marginTop:-4}}>パスワードが違います</p>}
      <button style={S.loginBtn} onClick={go}>ログイン</button>
    </div>
  </div>;
}

export default function App(){
  const [authed,setAuthed]=useState(false);
  const [tab,setTab]=useState("cleaning");
  const [month,setMonth]=useState(toMonth());
  const [props,setProps]=useState(DEFAULT_PROPS);
  const [staffList,setStaffList]=useState(DEFAULT_STAFF);
  const [cleanData,setCleanData]=useState({});
  const [monthCntData,setMonthCntData]=useState({});
  // 宿泊清掃
  const [stayProps,setStayProps]=useState(DEFAULT_STAY_PROPS);
  const [stayClean,setStayClean]=useState({});
  const [stayMonthCnt,setStayMonthCnt]=useState({});
  const [cases,setCases]=useState([]);
  const [jobs,setJobs]=useState([]);
  const [customers,setCustomers]=useState([]);
  const [cfg,setCfg]=useState(DEFAULT_CFG);
  const [password,setPassword]=useState(DEFAULT_PASSWORD);
  const [toast,setToast]=useState("");
  const [loading,setLoading]=useState(true);
  const [newCount,setNewCount]=useState(0);
  const showToast=msg=>{setToast(msg);setTimeout(()=>setToast(""),2500);};

  useEffect(()=>{(async()=>{const pw=await stGet(SK.password);if(pw)setPassword(pw);})();}, []);
  useEffect(()=>{
    if(!authed)return;
    (async()=>{
      const [p,cl,ca,c,sf,mc,j,cu,sp,sc,smc]=await Promise.all([
        stGet(SK.properties),stGet(SK.cleaning),stGet(SK.cases),stGet(SK.settings),
        stGet(SK.staff),stGet(SK.monthcnt),stGet(SK.jobs),stGet(SK.customers),
        stGet(SK.stayProps),stGet(SK.stayClean),stGet(SK.stayMonthCnt),
      ]);
      if(p)setProps(p); if(cl)setCleanData(cl); if(ca)setCases(ca); if(c)setCfg(c);
      if(sf)setStaffList(sf.map(toStaffObj)); if(mc)setMonthCntData(mc);
      if(j){setJobs(j);setNewCount((j||[]).filter(x=>x.isNew&&x.status!=="完了"&&x.status!=="キャンセル").length);}
      if(cu)setCustomers(cu);
      if(sp)setStayProps(sp); if(sc)setStayClean(sc); if(smc)setStayMonthCnt(smc);
      setLoading(false);
    })();
  },[authed]);

  const saveProps=async v=>{setProps(v);await stSet(SK.properties,v);};
  const saveClean=async v=>{setCleanData(v);await stSet(SK.cleaning,v);};
  const saveMonthCnt=async v=>{setMonthCntData(v);await stSet(SK.monthcnt,v);};
  const saveStayProps=async v=>{setStayProps(v);await stSet(SK.stayProps,v);};
  const saveStayClean=async v=>{setStayClean(v);await stSet(SK.stayClean,v);};
  const saveStayMonthCnt=async v=>{setStayMonthCnt(v);await stSet(SK.stayMonthCnt,v);};
  const saveCases=async v=>{setCases(v);await stSet(SK.cases,v);};
  const saveJobs=async v=>{setJobs(v);await stSet(SK.jobs,v);};
  const saveCustomers=async v=>{setCustomers(v);await stSet(SK.customers,v);};
  const saveCfg=async v=>{setCfg(v);await stSet(SK.settings,v);};
  const saveStaff=async v=>{setStaffList(v);await stSet(SK.staff,v);};
  const savePassword=async v=>{setPassword(v);await stSet(SK.password,v);};

  const carryOver=async()=>{
    const nm=nextMo(month);
    const newClean={...cleanData};const newMc={...monthCntData};
    props.forEach(p=>{
      const curCnt=monthCntData[mcKey(month,p.id)]??p.cnt;
      if(!(mcKey(nm,p.id) in newMc))newMc[mcKey(nm,p.id)]=curCnt;
      stNames(staffList).forEach(s=>{const k=cdKey(nm,p.id,s);if(!(k in newClean))newClean[k]=0;});
    });
    // 宿泊清掃も翌月初期化
    const newSC={...stayClean};const newSMC={...stayMonthCnt};
    stayProps.forEach(p=>{
      stNames(staffList).forEach(s=>{const k=cdKey(nm,p.id,s);if(!(k in newSC))newSC[k]=0;});
    });
    await saveClean(newClean);await saveMonthCnt(newMc);
    await saveStayClean(newSC);await saveStayMonthCnt(newSMC);
    setMonth(nm);showToast(`✅ ${nm} にコピーしました`);
  };

  const completeJob=async(job)=>{
    if(!job.amount){showToast("⚠ 金額を入力してから完了にしてください");return;}
    const updated=(jobs||[]).map(j=>j.id===job.id?{...j,status:"完了",isNew:false,completedAt:toDay()}:j);
    await saveJobs(updated);
    const nc={id:Date.now(),date:job.workDate||toDay(),name:`${job.client} ${job.content}`,staff:job.staff,payment:job.payment||"振込",amount:Number(job.amount)};
    await saveCases([nc,...(cases||[])]);
    setNewCount(n=>Math.max(0,n-1));
    showToast("✅ 完了！売上に反映しました");
  };

  const clearNew=()=>{
    const updated=(jobs||[]).map(j=>({...j,isNew:false}));
    saveJobs(updated);setNewCount(0);
  };

  if(!authed)return <Login onLogin={()=>setAuthed(true)} password={password}/>;

  const tabs=[
    ["cleaning","🏠清掃"],
    ["stay","🏨宿泊"],
    ["cases","📋売上"],
    ["jobs","🗂案件"+(newCount>0?"🆕":"")],
    ["future","📅来月〜"],
    ["estimate","💴見積"],
    ["customers","👥顧客"],
    ["closing","📊締め"],
    ["cfg","⚙設定"],
  ];

  return <div style={S.app}><style>{css}</style>
    {toast&&<div style={S.toast}>{toast}</div>}
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
        <button key={k} style={{...S.tab,...(tab===k?S.tabOn:{})}} onClick={()=>{setTab(k);if(k==="jobs")clearNew();}}>{v}</button>
      ))}
    </div>
    <div style={S.body}>
      {loading?<div style={S.empty}>読み込み中…</div>:<>
        {tab==="cleaning"&&<CleaningTab month={month} props={props} staffList={staffList} cleanData={cleanData} saveClean={saveClean} monthCntData={monthCntData} saveMonthCnt={saveMonthCnt} carryOver={carryOver}/>}
        {tab==="stay"&&<StayTab month={month} stayProps={stayProps} staffList={staffList} stayClean={stayClean} saveStayClean={saveStayClean}/>}
        {tab==="cases"&&<CasesTab month={month} cases={cases} staffList={staffList} saveCases={saveCases} showToast={showToast}/>}
        {tab==="jobs"&&<JobsTab jobs={jobs} saveJobs={saveJobs} customers={customers} saveCustomers={saveCustomers} staffList={staffList} completeJob={completeJob} showToast={showToast}/>}
        {tab==="future"&&<FutureTab jobs={jobs} saveJobs={saveJobs} staffList={staffList} setTab={setTab} showToast={showToast}/>}
        {tab==="estimate"&&<EstimateTab jobs={jobs} saveJobs={saveJobs} staffList={staffList} setTab={setTab} showToast={showToast}/>}
        {tab==="customers"&&<CustomersTab customers={customers} saveCustomers={saveCustomers} jobs={jobs} showToast={showToast}/>}
        {tab==="closing"&&<ClosingTab month={month} props={props} staffList={staffList} cleanData={cleanData} monthCntData={monthCntData} stayProps={stayProps} stayClean={stayClean} cases={cases} cfg={cfg} saveCfg={saveCfg} showToast={showToast}/>}
        {tab==="cfg"&&<CfgTab props={props} saveProps={saveProps} staffList={staffList} saveStaff={saveStaff} cfg={cfg} saveCfg={saveCfg} password={password} savePassword={savePassword} stayProps={stayProps} saveStayProps={saveStayProps} showToast={showToast}/>}
      </>}
    </div>
  </div>;
}

// ══════════════════════════════════════════
// 🏨 宿泊清掃タブ
// ══════════════════════════════════════════
function StayTab({month,stayProps,staffList,stayClean,saveStayClean}){
  const names=stNames(staffList);
  const [memoPopup,setMemoPopup]=useState(null);

  const getC=(pid,st)=>Number(stayClean[cdKey(month,pid,st)]||0);
  const setC=useCallback(async(pid,st,num)=>{
    await saveStayClean({...stayClean,[cdKey(month,pid,st)]:num});
  },[month,stayClean,saveStayClean]);

  const getPropSales=useCallback(p=>{
    const counts={};names.forEach(st=>counts[st]=getC(p.id,st));
    return calcStayStaffSales(p.unitPrice,counts,names);
  },[month,stayProps,staffList,stayClean]);

  const stTotal=st=>(stayProps||[]).reduce((s,p)=>{
    const sales=getPropSales(p);
    return s+(sales[names.indexOf(st)]||0);
  },0);
  const grand=names.reduce((s,st)=>s+stTotal(st),0);
  const hasMemo=p=>p.address||p.note;

  if(!stayProps||stayProps.length===0){
    return <div style={{animation:"fadeUp .3s ease"}}>
      <div style={S.empty}>
        <div style={{fontSize:32,marginBottom:12}}>🏨</div>
        <div style={{fontWeight:700,color:"#aaa",marginBottom:8}}>宿泊清掃物件が未登録です</div>
        <div style={{fontSize:12,color:"#ccc"}}>⚙設定タブ →「🏨宿泊清掃物件マスタ」から物件を追加してください</div>
      </div>
    </div>;
  }

  return <div style={{animation:"fadeUp .3s ease"}}>
    <div style={S.staffBar}>
      {names.map(st=><div key={st} style={S.staffCell}><div style={S.staffLabel}>{st}</div><div style={S.staffAmt}>{yen(stTotal(st))}</div></div>)}
      <div style={{...S.staffCell,background:"#1e6091",border:"none"}}><div style={{...S.staffLabel,color:"rgba(255,255,255,0.7)"}}>合計</div><div style={{...S.staffAmt,color:"#fff"}}>{yen(grand)}</div></div>
    </div>
    <div style={S.tableWrap}><table>
      <thead><tr>
        <th style={{textAlign:"left",minWidth:110}}>物件名</th>
        <th>1回単価</th>
        {names.map(st=><th key={st} style={{color:"#1e6091"}}>{st}<br/>回数</th>)}
        {names.map(st=><th key={st+"$"} style={{color:"#2d6a4f"}}>{st}<br/>売上</th>)}
        <th>物件計</th>
      </tr></thead>
      <tbody>{(stayProps||[]).map(p=>{
        const sales=getPropSales(p);
        const totalCnt=names.reduce((s,st)=>s+getC(p.id,st),0);
        const propTotal=sales.reduce((a,b)=>a+b,0);
        return <tr key={p.id}>
          <td style={{textAlign:"left",fontSize:11,fontWeight:500}}>
            <div style={{display:"flex",alignItems:"center",gap:4}}>
              <span>{p.name}</span>
              {hasMemo(p)&&<button onClick={()=>setMemoPopup(p)} style={{background:"none",border:"none",cursor:"pointer",fontSize:13,padding:"0 2px",lineHeight:1,color:"#1e6091",flexShrink:0}}>📍</button>}
            </div>
            {p.type&&<div style={{fontSize:9,color:"#aaa",marginTop:1}}>{p.type==="minpaku"?"民泊":"マンスリー"}</div>}
          </td>
          <td style={{color:"#1e6091",fontWeight:600}}>{yen(p.unitPrice||0)}</td>
          {names.map(st=><td key={st}><NumInput value={getC(p.id,st)} onCommit={num=>setC(p.id,st,num)} min={0} style={{width:44,textAlign:"center",padding:"4px 2px"}}/></td>)}
          {sales.map((s,i)=><td key={names[i]+"$"} style={{fontWeight:600,color:"#2d6a4f"}}>{yen(s)}</td>)}
          <td style={{fontWeight:700,color:totalCnt>0?"#2d6a4f":"#333"}}>{yen(propTotal)}</td>
        </tr>;
      })}</tbody>
      <tfoot><tr style={{background:"#f0f7ff"}}>
        <td style={{textAlign:"left",fontWeight:700}} colSpan={2}>合計</td>
        {names.map(st=><td key={st}/>)}
        {names.map(st=><td key={st+"$"} style={{fontWeight:700,color:"#1e6091"}}>{yen(stTotal(st))}</td>)}
        <td style={{fontWeight:700}}>{yen(grand)}</td>
      </tr></tfoot>
    </table></div>

    {memoPopup&&<div style={S.modalBg} onClick={()=>setMemoPopup(null)}>
      <div style={{...S.modal,paddingBottom:32}} onClick={e=>e.stopPropagation()}>
        <div style={{fontWeight:700,fontSize:16,color:"#1e6091",marginBottom:16}}>📍 {memoPopup.name}</div>
        {memoPopup.type&&<div style={{marginBottom:10}}>
          <span style={{background:"#dbeafe",color:"#1e40af",borderRadius:6,padding:"3px 10px",fontSize:12,fontWeight:700}}>
            {memoPopup.type==="minpaku"?"🏨 民泊":"🏢 マンスリー"}
          </span>
        </div>}
        {memoPopup.address&&<div style={{marginBottom:12}}>
          <div style={{fontSize:11,color:"#aaa",marginBottom:4}}>住所</div>
          <div style={{fontSize:14,fontWeight:500,color:"#333",background:"#faf8f5",borderRadius:8,padding:"10px 12px",lineHeight:1.6}}>{memoPopup.address}</div>
          <a href={`https://maps.google.com/?q=${encodeURIComponent(memoPopup.address)}`} target="_blank" rel="noreferrer"
            style={{display:"inline-block",marginTop:6,fontSize:12,color:"#1e40af",textDecoration:"none",background:"#dbeafe",borderRadius:6,padding:"4px 10px"}}>
            🗺 Googleマップで開く
          </a>
        </div>}
        {memoPopup.note&&<div style={{marginBottom:12}}>
          <div style={{fontSize:11,color:"#aaa",marginBottom:4}}>メモ</div>
          <div style={{fontSize:13,color:"#555",background:"#faf8f5",borderRadius:8,padding:"10px 12px",lineHeight:1.7,whiteSpace:"pre-wrap"}}>{memoPopup.note}</div>
        </div>}
        <button style={{...S.cancelBtn,width:"100%",marginTop:8}} onClick={()=>setMemoPopup(null)}>閉じる</button>
      </div>
    </div>}
  </div>;
}

function JobsTab({jobs,saveJobs,customers,saveCustomers,staffList,completeJob,showToast}){
  const [view,setView]=useState("list");
  const [filterStatus,setFilterStatus]=useState("全て");
  const [showForm,setShowForm]=useState(false);
  const [editJob,setEditJob]=useState(null);
  const [calMonth,setCalMonth]=useState(toMonth());
  const names=stNames(staffList);
  const blank=()=>({client:"",content:"",status:"見積済",workDate:"",staff:names[0]||"",address:"",phone:"",payment:"振込",amount:"",memo:""});
  const [form,setForm]=useState(blank());

  const filtered=useMemo(()=>{
    const cur=toMonth();
    let r=(jobs||[]).filter(j=>{
      if(j.workDate&&j.workDate>cur+"-31")return false;
      return true;
    });
    if(filterStatus!=="全て")r=r.filter(j=>j.status===filterStatus);
    return [...r].sort((a,b)=>{
      if(a.workDate&&b.workDate)return a.workDate.localeCompare(b.workDate);
      if(a.workDate)return -1;
      if(b.workDate)return 1;
      return (b.createdAt||0)-(a.createdAt||0);
    });
  },[jobs,filterStatus]);

  const openForm=(job=null)=>{
    if(job){setForm({...job,amount:String(job.amount||"")});setEditJob(job.id);}
    else{setForm(blank());setEditJob(null);}
    setShowForm(true);
  };
  const selectCustomer=name=>{
    const c=(customers||[]).find(c=>c.name===name);
    setForm(f=>({...f,client:name,address:c?.address||f.address,phone:c?.phone||f.phone}));
  };
  const saveJob=async()=>{
    if(!form.client||!form.content){showToast("⚠ 依頼者・依頼内容は必須");return;}
    const now=Date.now();
    if(editJob){
      await saveJobs((jobs||[]).map(j=>j.id===editJob?{...form,id:editJob,amount:Number(form.amount)||0,updatedAt:now}:j));
      showToast("✅ 更新しました");
    }else{
      const nj={...form,id:now,amount:Number(form.amount)||0,createdAt:now,isNew:true};
      await saveJobs([nj,...(jobs||[])]);
      if(form.client){
        const ex=(customers||[]).find(c=>c.name===form.client);
        if(!ex)await saveCustomers([...(customers||[]),{id:now,name:form.client,address:form.address,phone:form.phone}]);
        else if(form.address&&!ex.address)await saveCustomers((customers||[]).map(c=>c.name===form.client?{...c,address:form.address,phone:form.phone}:c));
      }
      showToast("✅ 案件を追加しました！");
    }
    setShowForm(false);setEditJob(null);setForm(blank());
  };
  const deleteJob=async id=>{if(!confirm("削除しますか？"))return;await saveJobs((jobs||[]).filter(j=>j.id!==id));showToast("🗑 削除しました");};
  const changeStatus=async(job,status)=>{
    if(status==="完了"){await completeJob({...job,amount:Number(job.amount)||0});return;}
    await saveJobs((jobs||[]).map(j=>j.id===job.id?{...j,status,isNew:false}:j));
    showToast(`✅ ${status} に変更しました`);
  };

  return <div style={{animation:"fadeUp .3s ease"}}>
    <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        {["全て",...STATUS_LIST].map(s=>(
          <button key={s} onClick={()=>setFilterStatus(s)} style={{
            padding:"5px 12px",borderRadius:20,border:"1.5px solid",fontSize:11,cursor:"pointer",fontWeight:600,
            background:filterStatus===s?"#c0392b":"#fff",color:filterStatus===s?"#fff":"#888",borderColor:filterStatus===s?"#c0392b":"#ddd"
          }}>{s}</button>
        ))}
      </div>
      <div style={{display:"flex",gap:6,marginLeft:"auto"}}>
        <div style={{display:"flex",gap:4}}>
          <button onClick={()=>setView("list")} style={{...S.cancelBtn,padding:"6px 10px",fontSize:11,background:view==="list"?"#c0392b":"#f5f5f5",color:view==="list"?"#fff":"#666"}}>📋</button>
          <button onClick={()=>setView("table")} style={{...S.cancelBtn,padding:"6px 10px",fontSize:11,background:view==="table"?"#c0392b":"#f5f5f5",color:view==="table"?"#fff":"#666"}}>☰</button>
          <button onClick={()=>setView("calendar")} style={{...S.cancelBtn,padding:"6px 10px",fontSize:11,background:view==="calendar"?"#c0392b":"#f5f5f5",color:view==="calendar"?"#fff":"#666"}}>📅</button>
        </div>
        <button onClick={()=>openForm()} style={{...S.saveBtn,width:"auto",padding:"8px 16px",fontSize:12}}>＋ 追加</button>
      </div>
    </div>

    {view==="calendar"&&<CalendarView jobs={jobs||[]} calMonth={calMonth} setCalMonth={setCalMonth} onClickJob={openForm}/>}
    {view==="table"&&<div style={{...S.tableWrap,marginBottom:12}}>
      {filtered.length===0?<div style={S.empty}>案件がありません</div>:
      <table>
        <thead><tr>
          <th style={{textAlign:"left",minWidth:80}}>依頼者</th>
          <th style={{textAlign:"left",minWidth:90}}>内容</th>
          <th>作業日</th><th>担当</th><th>状況</th>
          <th style={{textAlign:"right"}}>金額</th><th></th>
        </tr></thead>
        <tbody>{filtered.map(job=>{
          const sc=STATUS_COLOR[job.status]||STATUS_COLOR["キャンセル"];
          return <tr key={job.id} style={{cursor:"pointer"}} onClick={()=>openForm(job)}>
            <td style={{textAlign:"left",fontWeight:600,maxWidth:80,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
              {job.isNew&&job.status!=="完了"&&job.status!=="キャンセル"&&<span style={{background:"#e03030",color:"#fff",fontSize:9,borderRadius:4,padding:"1px 4px",marginRight:4}}>NEW</span>}
              {job.client}
            </td>
            <td style={{textAlign:"left",color:"#666",maxWidth:90,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{job.content}</td>
            <td style={{whiteSpace:"nowrap",fontSize:11}}>{job.workDate||"−"}</td>
            <td style={{textAlign:"center"}}><span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:22,height:22,borderRadius:"50%",background:"#f5eeee",color:"#8b0000",fontSize:11,fontWeight:700}}>{job.staff?job.staff[0]:"?"}</span></td>
            <td><span style={{background:sc.bg,color:sc.color,border:`1px solid ${sc.border}`,borderRadius:6,padding:"2px 6px",fontSize:10,fontWeight:700,whiteSpace:"nowrap",display:"inline-block"}}>{job.status}</span></td>
            <td style={{textAlign:"right",fontWeight:600,color:"#2d6a4f"}}>{job.amount>0?yen(job.amount):"−"}</td>
            <td onClick={e=>e.stopPropagation()}>
              {job.status==="確定"&&<button onClick={()=>changeStatus(job,"完了")} style={{background:"#dcfce7",border:"1px solid #86efac",borderRadius:6,fontSize:10,cursor:"pointer",color:"#166534",padding:"2px 6px",whiteSpace:"nowrap"}}>✅完了</button>}
            </td>
          </tr>;
        })}</tbody>
      </table>}
    </div>}

    {view==="list"&&<div style={{display:"flex",flexDirection:"column",gap:10}}>
      {filtered.length===0?<div style={S.empty}>案件がありません</div>:filtered.map(job=>{
        const sc=STATUS_COLOR[job.status]||STATUS_COLOR["キャンセル"];
        return <div key={job.id} style={{background:"#fff",borderRadius:14,padding:14,boxShadow:"0 2px 8px rgba(180,0,0,0.07)",borderLeft:`4px solid ${sc.border}`,position:"relative"}}>
          {job.isNew&&job.status!=="完了"&&job.status!=="キャンセル"&&
            <span style={{position:"absolute",top:10,right:10,background:"#e03030",color:"#fff",fontSize:10,fontWeight:700,borderRadius:6,padding:"2px 6px"}}>🆕 NEW</span>}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
            <div>
              <div style={{fontWeight:700,fontSize:14}}>{job.client}</div>
              <div style={{fontSize:12,color:"#666",marginTop:2}}>{job.content}</div>
            </div>
            <span style={{background:sc.bg,color:sc.color,border:`1px solid ${sc.border}`,borderRadius:8,padding:"3px 10px",fontSize:11,fontWeight:700,flexShrink:0,marginLeft:8}}>{job.status}</span>
          </div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap",fontSize:11,color:"#888",marginBottom:10}}>
            {job.workDate&&<span>📅 {job.workDate}</span>}
            {job.staff&&<span>👤 {job.staff}</span>}
            {job.address&&<span>📍 {job.address.length>16?job.address.slice(0,16)+"…":job.address}</span>}
            {job.phone&&<a href={`tel:${job.phone}`} style={{color:"#c0392b",textDecoration:"none"}}>📞 {job.phone}</a>}
            {job.amount>0&&<span style={{color:"#2d6a4f",fontWeight:700}}>¥{Number(job.amount).toLocaleString()}</span>}
          </div>
          {job.memo&&<div style={{fontSize:11,color:"#999",background:"#faf8f5",borderRadius:8,padding:"6px 10px",marginBottom:10}}>{job.memo}</div>}
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            <button onClick={()=>openForm(job)} style={{...S.cancelBtn,padding:"6px 12px",fontSize:11,flex:1}}>✏️ 編集</button>
            {job.status==="見積済"&&<button onClick={()=>changeStatus(job,"確定")} style={{flex:1,padding:"6px 0",background:"#dbeafe",border:"1.5px solid #93c5fd",borderRadius:8,fontSize:11,cursor:"pointer",color:"#1e40af",fontWeight:700}}>📋 確定にする</button>}
            {job.status==="確定"&&<button onClick={()=>changeStatus(job,"完了")} style={{flex:1,padding:"6px 0",background:"#dcfce7",border:"1.5px solid #86efac",borderRadius:8,fontSize:11,cursor:"pointer",color:"#166534",fontWeight:700}}>✅ 完了→売上反映</button>}
            {job.status==="完了"&&<div style={{flex:1,padding:"6px 0",background:"#f0fdf4",border:"1.5px solid #86efac",borderRadius:8,fontSize:11,color:"#166534",fontWeight:700,textAlign:"center"}}>💰 売上反映済</div>}
            <button onClick={()=>deleteJob(job.id)} style={{padding:"6px 10px",background:"none",border:"1.5px solid #eee",borderRadius:8,fontSize:11,cursor:"pointer",color:"#ccc"}}>✕</button>
          </div>
        </div>;
      })}
    </div>}

    {showForm&&<div style={S.modalBg} onClick={()=>setShowForm(false)}>
      <div style={S.modal} onClick={e=>e.stopPropagation()}>
        <div style={{fontWeight:700,fontSize:15,color:"#8b0000",marginBottom:14}}>{editJob?"✏️ 案件を編集":"➕ 案件を追加"}</div>
        <FR label="依頼者">
          <input type="text" value={form.client} onChange={e=>{setForm({...form,client:e.target.value});selectCustomer(e.target.value);}} placeholder="鳥井さん" list="clist"/>
          <datalist id="clist">{(customers||[]).map(c=><option key={c.id} value={c.name}/>)}</datalist>
        </FR>
        <FR label="依頼内容"><input type="text" value={form.content} onChange={e=>setForm({...form,content:e.target.value})} placeholder="ゴキブリ駆除・掃除"/></FR>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}>
          <FR label="作業日"><input type="date" value={form.workDate} onChange={e=>setForm({...form,workDate:e.target.value})}/></FR>
          <FR label="担当"><select value={form.staff} onChange={e=>setForm({...form,staff:e.target.value})}>{names.map(n=><option key={n}>{n}</option>)}</select></FR>
          <FR label="状況"><select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{STATUS_LIST.map(s=><option key={s}>{s}</option>)}</select></FR>
          <FR label="支払"><select value={form.payment} onChange={e=>setForm({...form,payment:e.target.value})}><option>振込</option><option>現金</option></select></FR>
        </div>
        <FR label="金額（円）"><input type="text" inputMode="numeric" value={form.amount} onChange={e=>{if(/^\d*$/.test(e.target.value))setForm({...form,amount:e.target.value});}} onFocus={e=>e.target.select()} placeholder="確定後に入力"/></FR>
        <FR label="現場住所"><input type="text" value={form.address} onChange={e=>setForm({...form,address:e.target.value})} placeholder="福岡市中央区…"/></FR>
        <FR label="電話番号"><input type="tel" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="090-xxxx-xxxx"/></FR>
        <FR label="メモ"><textarea value={form.memo} onChange={e=>setForm({...form,memo:e.target.value})} rows={2} style={{width:"100%",border:"1.5px solid #e0d0d0",borderRadius:8,padding:"7px 10px",fontSize:13,resize:"vertical",outline:"none"}}/></FR>
        <div style={{display:"flex",gap:8,marginTop:8}}>
          <button style={S.cancelBtn} onClick={()=>setShowForm(false)}>キャンセル</button>
          <button style={S.saveBtn} onClick={saveJob}>{editJob?"更新":"保存"}</button>
        </div>
      </div>
    </div>}
  </div>;
}

function FutureTab({jobs,saveJobs,staffList,setTab,showToast}){
  const cur=toMonth();
  const futureJobs=useMemo(()=>{
    return (jobs||[]).filter(j=>{
      if(j.status==="完了"||j.status==="キャンセル")return false;
      if(j.workDate&&j.workDate>cur+"-31")return true;
      if(j.status==="見込み"&&(!j.workDate||j.workDate>cur+"-31"))return true;
      return false;
    }).sort((a,b)=>{
      if(a.workDate&&b.workDate)return a.workDate.localeCompare(b.workDate);
      if(a.workDate)return -1;if(b.workDate)return 1;return 0;
    });
  },[jobs,cur]);

  const movedToThisMonth=useMemo(()=>{
    return (jobs||[]).filter(j=>{
      if(j.status==="完了"||j.status==="キャンセル")return false;
      if(j.workDate&&j.workDate>=cur+"-01"&&j.workDate<=cur+"-31")return true;
      return false;
    });
  },[jobs,cur]);

  const grouped=useMemo(()=>{
    const m={};
    futureJobs.forEach(j=>{
      const key=j.workDate?j.workDate.slice(0,7):"未定";
      if(!m[key])m[key]=[];m[key].push(j);
    });
    return Object.entries(m).sort(([a],[b])=>{
      if(a==="未定")return 1;if(b==="未定")return -1;return a.localeCompare(b);
    });
  },[futureJobs]);

  const moveToJobs=(job)=>{setTab("jobs");showToast(`✅ 案件管理タブで ${job.client} を確認できます`);};

  return <div style={{animation:"fadeUp .3s ease"}}>
    {movedToThisMonth.length>0&&<div style={{background:"#dbeafe",borderRadius:12,padding:"10px 14px",marginBottom:12,fontSize:12,color:"#1e40af"}}>
      📋 当月に入った案件が {movedToThisMonth.length}件 あります →
      <button onClick={()=>setTab("jobs")} style={{background:"none",border:"none",color:"#1e40af",fontWeight:700,cursor:"pointer",textDecoration:"underline",fontSize:12}}>案件管理で確認</button>
    </div>}
    {futureJobs.length===0
      ?<div style={S.empty}>来月以降の案件・見込みがありません</div>
      :grouped.map(([month,mJobs])=><div key={month} style={{marginBottom:16}}>
        <div style={{fontWeight:700,fontSize:13,color:"#8b0000",marginBottom:8,display:"flex",alignItems:"center",gap:8}}>
          📅 {month==="未定"?"日程未定":month.replace("-","年")+"月"}
          <span style={{background:"#f5eeee",color:"#888",borderRadius:10,padding:"1px 8px",fontSize:11}}>{mJobs.length}件</span>
        </div>
        <div style={{...S.tableWrap}}>
          <table>
            <thead><tr>
              <th style={{textAlign:"left"}}>依頼者</th><th style={{textAlign:"left"}}>内容</th>
              <th>作業日</th><th>担当</th><th>状況</th><th style={{textAlign:"right"}}>金額</th><th></th>
            </tr></thead>
            <tbody>{mJobs.map(job=>{
              const sc=STATUS_COLOR[job.status]||STATUS_COLOR["キャンセル"];
              return <tr key={job.id}>
                <td style={{textAlign:"left",fontWeight:600,maxWidth:80,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{job.client}</td>
                <td style={{textAlign:"left",color:"#666",fontSize:11,maxWidth:90,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{job.content}</td>
                <td style={{whiteSpace:"nowrap",fontSize:11}}>{job.workDate||"未定"}</td>
                <td style={{textAlign:"center"}}><span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:22,height:22,borderRadius:"50%",background:"#f5eeee",color:"#8b0000",fontSize:11,fontWeight:700}}>{job.staff?job.staff[0]:"?"}</span></td>
                <td><span style={{background:sc.bg,color:sc.color,border:`1px solid ${sc.border}`,borderRadius:6,padding:"2px 6px",fontSize:10,fontWeight:700,whiteSpace:"nowrap",display:"inline-block"}}>{job.status}</span></td>
                <td style={{textAlign:"right",fontWeight:600,color:"#2d6a4f",fontSize:11}}>{job.amount>0?yen(job.amount):"−"}</td>
                <td><button onClick={()=>moveToJobs(job)} style={{background:"none",border:"1px solid #ddd",borderRadius:6,fontSize:10,cursor:"pointer",color:"#888",padding:"2px 6px",whiteSpace:"nowrap"}}>詳細→</button></td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      </div>)
    }
  </div>;
}

function CalendarView({jobs,calMonth,setCalMonth,onClickJob}){
  const [y,m]=calMonth.split("-").map(Number);
  const firstDay=new Date(y,m-1,1).getDay();
  const daysInMonth=new Date(y,m,0).getDate();
  const prev=()=>setCalMonth(m===1?`${y-1}-12`:`${y}-${String(m-1).padStart(2,"0")}`);
  const next=()=>setCalMonth(m===12?`${y+1}-01`:`${y}-${String(m+1).padStart(2,"0")}`);
  const jobsByDate=useMemo(()=>{
    const map={};
    (jobs||[]).filter(j=>j.workDate&&j.workDate.startsWith(calMonth)).forEach(j=>{
      const d=j.workDate.slice(8,10);if(!map[d])map[d]=[];map[d].push(j);
    });
    return map;
  },[jobs,calMonth]);
  const cells=[];
  for(let i=0;i<firstDay;i++)cells.push(null);
  for(let d=1;d<=daysInMonth;d++)cells.push(d);
  const todayD=toDay().slice(8,10);
  return <div style={{...S.card,marginBottom:12}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
      <button onClick={prev} style={{...S.cancelBtn,padding:"6px 14px"}}>＜</button>
      <span style={{fontWeight:700,fontSize:15}}>{y}年{m}月</span>
      <button onClick={next} style={{...S.cancelBtn,padding:"6px 14px"}}>＞</button>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(7,minmax(0,1fr))",gap:2,marginBottom:6}}>
      {WEEKDAYS.map((w,i)=><div key={w} style={{textAlign:"center",fontSize:11,fontWeight:700,color:i===0?"#e03030":i===6?"#1e40af":"#888",padding:"4px 0"}}>{w}</div>)}
      {cells.map((d,i)=>{
        if(!d)return <div key={`e${i}`}/>;
        const ds=String(d).padStart(2,"0");
        const dj=jobsByDate[ds]||[];
        const isToday=todayD===ds&&calMonth===toMonth();
        return <div key={d} style={{minHeight:54,background:isToday?"#fff5f5":"#fafafa",borderRadius:8,padding:"4px 3px",border:isToday?"2px solid #e03030":"1px solid #f0ece4",overflow:"hidden",minWidth:0}}>
          <div style={{fontSize:11,fontWeight:700,color:isToday?"#e03030":"#333",marginBottom:2}}>{d}</div>
          {dj.map(j=>{const sc=STATUS_COLOR[j.status]||{};const short=j.client.length>4?j.client.slice(0,4)+"…":j.client;return <div key={j.id} onClick={()=>onClickJob(j)} style={{fontSize:9,background:sc.bg||"#eee",color:sc.color||"#333",borderRadius:4,padding:"1px 3px",marginBottom:1,cursor:"pointer",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",width:"100%"}}>{short}</div>;})}
        </div>;
      })}
    </div>
    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
      {STATUS_LIST.map(s=>{const sc=STATUS_COLOR[s];return <span key={s} style={{background:sc.bg,color:sc.color,border:`1px solid ${sc.border}`,borderRadius:6,padding:"2px 8px",fontSize:10}}>{s}</span>;})}
    </div>
  </div>;
}

function CustomersTab({customers,saveCustomers,jobs,showToast}){
  const [selected,setSelected]=useState(null);
  const [editMode,setEditMode]=useState(false);
  const [form,setForm]=useState({name:"",address:"",phone:""});
  const custJobs=useMemo(()=>{if(!selected)return[];return (jobs||[]).filter(j=>j.client===selected.name).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));},[selected,jobs]);
  const saveEdit=async()=>{
    if(!form.name){showToast("⚠ 顧客名は必須");return;}
    if(selected)await saveCustomers((customers||[]).map(c=>c.id===selected.id?{...c,...form}:c));
    else await saveCustomers([...(customers||[]),{id:Date.now(),...form}]);
    setEditMode(false);setSelected(null);showToast("✅ 保存しました");
  };
  const del=async id=>{if(!confirm("削除しますか？"))return;await saveCustomers((customers||[]).filter(c=>c.id!==id));setSelected(null);showToast("🗑 削除しました");};

  if(editMode)return <div style={{animation:"fadeUp .3s ease"}}>
    <div style={S.card}>
      <div style={{fontWeight:700,fontSize:15,color:"#8b0000",marginBottom:14}}>{selected?"✏️ 顧客を編集":"➕ 顧客を追加"}</div>
      <FR label="顧客名"><input type="text" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="鳥井さん"/></FR>
      <FR label="住所"><input type="text" value={form.address} onChange={e=>setForm({...form,address:e.target.value})} placeholder="福岡市中央区…"/></FR>
      <FR label="電話番号"><input type="tel" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="090-xxxx-xxxx"/></FR>
      <div style={{display:"flex",gap:8,marginTop:4}}><button style={S.cancelBtn} onClick={()=>setEditMode(false)}>キャンセル</button><button style={S.saveBtn} onClick={saveEdit}>保存</button></div>
    </div>
  </div>;

  if(selected)return <div style={{animation:"fadeUp .3s ease"}}>
    <button onClick={()=>setSelected(null)} style={{...S.cancelBtn,marginBottom:12,fontSize:12}}>← 一覧に戻る</button>
    <div style={{...S.card,marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div>
          <div style={{fontWeight:700,fontSize:18}}>{selected.name}</div>
          {selected.address&&<div style={{fontSize:12,color:"#888",marginTop:4}}>📍 {selected.address}</div>}
          {selected.phone&&<a href={`tel:${selected.phone}`} style={{display:"block",fontSize:12,color:"#c0392b",marginTop:4,textDecoration:"none"}}>📞 {selected.phone}</a>}
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>{setForm({name:selected.name,address:selected.address||"",phone:selected.phone||""});setEditMode(true);}} style={{...S.cancelBtn,padding:"6px 12px",fontSize:11}}>✏️</button>
          <button onClick={()=>del(selected.id)} style={{...S.cancelBtn,padding:"6px 12px",fontSize:11,color:"#e74c3c"}}>✕</button>
        </div>
      </div>
    </div>
    <div style={S.sTitle}>📋 案件履歴（{custJobs.length}件）</div>
    {custJobs.length===0?<div style={S.empty}>案件履歴がありません</div>:custJobs.map(j=>{
      const sc=STATUS_COLOR[j.status]||{};
      return <div key={j.id} style={{...S.card,marginBottom:8}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
          <span style={{fontWeight:600,fontSize:13}}>{j.content}</span>
          <span style={{background:sc.bg,color:sc.color,border:`1px solid ${sc.border}`,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700}}>{j.status}</span>
        </div>
        <div style={{display:"flex",gap:10,fontSize:11,color:"#888",flexWrap:"wrap"}}>
          {j.workDate&&<span>📅 {j.workDate}</span>}
          {j.staff&&<span>👤 {j.staff}</span>}
          {j.amount>0&&<span style={{color:"#2d6a4f",fontWeight:700}}>¥{Number(j.amount).toLocaleString()}</span>}
        </div>
        {j.memo&&<div style={{fontSize:11,color:"#999",marginTop:6}}>{j.memo}</div>}
      </div>;
    })}
  </div>;

  return <div style={{animation:"fadeUp .3s ease"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
      <div style={{fontSize:13,color:"#888"}}>{(customers||[]).length}件の顧客</div>
      <button onClick={()=>{setSelected(null);setForm({name:"",address:"",phone:""});setEditMode(true);}} style={{...S.saveBtn,width:"auto",padding:"8px 16px",fontSize:12}}>＋ 顧客を追加</button>
    </div>
    {(customers||[]).length===0?<div style={S.empty}>顧客データがありません<br/><span style={{fontSize:11}}>案件管理で案件を追加すると自動で登録されます</span></div>
    :(customers||[]).map(c=>{
      const cj=(jobs||[]).filter(j=>j.client===c.name);
      const lj=cj.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0))[0];
      return <div key={c.id} onClick={()=>setSelected(c)} style={{...S.card,cursor:"pointer",marginBottom:8}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontWeight:700,fontSize:14}}>{c.name}</div>
            {c.phone&&<a href={`tel:${c.phone}`} onClick={e=>e.stopPropagation()} style={{fontSize:11,color:"#c0392b",textDecoration:"none"}}>📞 {c.phone}</a>}
            {c.address&&<div style={{fontSize:11,color:"#888",marginTop:2}}>📍 {c.address.length>20?c.address.slice(0,20)+"…":c.address}</div>}
          </div>
          <div style={{textAlign:"right",fontSize:11,color:"#aaa"}}>
            <div>案件 {cj.length}件</div>
            {lj&&<div>最終: {lj.workDate||"日付なし"}</div>}
          </div>
        </div>
      </div>;
    })}
  </div>;
}

function CleaningTab({month,props,staffList,cleanData,saveClean,monthCntData,saveMonthCnt,carryOver}){
  const names=stNames(staffList);
  const [memoPopup,setMemoPopup]=useState(null);
  const getMc=pid=>monthCntData[mcKey(month,pid)]??(props.find(p=>p.id===pid)?.cnt||0);
  const getC=(pid,st)=>Number(cleanData[cdKey(month,pid,st)]||0);
  const setMc=useCallback(async(pid,num)=>{await saveMonthCnt({...monthCntData,[mcKey(month,pid)]:num});},[month,monthCntData,saveMonthCnt]);
  const setC=useCallback(async(pid,st,num)=>{await saveClean({...cleanData,[cdKey(month,pid,st)]:num});},[month,cleanData,saveClean]);
  const getPropSales=useCallback(p=>{const mc=getMc(p.id);const counts={};names.forEach(st=>counts[st]=getC(p.id,st));return calcStaffSales(p.fee,mc,counts,names);},[month,props,staffList,cleanData,monthCntData]);
  const stTotal=st=>props.reduce((s,p)=>{const sales=getPropSales(p);return s+(sales[names.indexOf(st)]||0);},0);
  const grand=names.reduce((s,st)=>s+stTotal(st),0);
  const hasMemo=p=>p.address||p.callNo||p.note;
  return <div style={{animation:"fadeUp .3s ease"}}>
    <div style={S.ctrlRow}><button style={S.redBtn} onClick={carryOver}>📋 翌月コピー</button></div>
    <div style={S.staffBar}>
      {names.map(st=><div key={st} style={S.staffCell}><div style={S.staffLabel}>{st}</div><div style={S.staffAmt}>{yen(stTotal(st))}</div></div>)}
      <div style={{...S.staffCell,background:"#c0392b",border:"none"}}><div style={{...S.staffLabel,color:"rgba(255,255,255,0.7)"}}>合計</div><div style={{...S.staffAmt,color:"#fff"}}>{yen(grand)}</div></div>
    </div>
    <div style={S.tableWrap}><table>
      <thead><tr>
        <th style={{textAlign:"left",minWidth:110}}>物件名</th><th>月額</th><th>月回数</th>
        {names.map(st=><th key={st} style={{color:"#c44"}}>{st}<br/>回数</th>)}
        {names.map(st=><th key={st+"$"} style={{color:"#2d6a4f"}}>{st}<br/>売上</th>)}
        <th>物件計</th>
      </tr></thead>
      <tbody>{props.map(p=>{
        const mc=getMc(p.id);const sales=getPropSales(p);
        const totalCnt=names.reduce((s,st)=>s+getC(p.id,st),0);
        const propTotal=sales.reduce((a,b)=>a+b,0);
        return <tr key={p.id}>
          <td style={{textAlign:"left",fontSize:11,fontWeight:500}}>
            <div style={{display:"flex",alignItems:"center",gap:4}}>
              <span>{p.name}</span>
              {hasMemo(p)&&<button onClick={()=>setMemoPopup(p)} style={{background:"none",border:"none",cursor:"pointer",fontSize:13,padding:"0 2px",lineHeight:1,color:"#c0392b",flexShrink:0}}>📍</button>}
            </div>
          </td>
          <td>{yen(p.fee)}</td>
          <td><NumInput value={mc} onCommit={num=>setMc(p.id,num)} min={1} style={{width:44,textAlign:"center",padding:"4px 2px"}}/></td>
          {names.map(st=><td key={st}><NumInput value={getC(p.id,st)} onCommit={num=>setC(p.id,st,num)} min={0} style={{width:44,textAlign:"center",padding:"4px 2px"}}/></td>)}
          {sales.map((s,i)=><td key={names[i]+"$"} style={{fontWeight:600,color:"#2d6a4f"}}>{yen(s)}</td>)}
          <td style={{fontWeight:700,color:totalCnt===mc&&mc>0?"#2d6a4f":"#333"}}>{yen(propTotal)}</td>
        </tr>;
      })}</tbody>
      <tfoot><tr style={{background:"#fff5f5"}}>
        <td style={{textAlign:"left",fontWeight:700}} colSpan={3}>合計</td>
        {names.map(st=><td key={st}/>)}
        {names.map(st=><td key={st+"$"} style={{fontWeight:700,color:"#c44"}}>{yen(stTotal(st))}</td>)}
        <td style={{fontWeight:700}}>{yen(grand)}</td>
      </tr></tfoot>
    </table></div>

    {memoPopup&&<div style={S.modalBg} onClick={()=>setMemoPopup(null)}>
      <div style={{...S.modal,paddingBottom:32}} onClick={e=>e.stopPropagation()}>
        <div style={{fontWeight:700,fontSize:16,color:"#8b0000",marginBottom:16}}>📍 {memoPopup.name}</div>
        {memoPopup.address&&<div style={{marginBottom:12}}>
          <div style={{fontSize:11,color:"#aaa",marginBottom:4}}>住所</div>
          <div style={{fontSize:14,fontWeight:500,color:"#333",background:"#faf8f5",borderRadius:8,padding:"10px 12px",lineHeight:1.6}}>{memoPopup.address}</div>
          <a href={`https://maps.google.com/?q=${encodeURIComponent(memoPopup.address)}`} target="_blank" rel="noreferrer"
            style={{display:"inline-block",marginTop:6,fontSize:12,color:"#1e40af",textDecoration:"none",background:"#dbeafe",borderRadius:6,padding:"4px 10px"}}>
            🗺 Googleマップで開く
          </a>
        </div>}
        {memoPopup.callNo&&<div style={{marginBottom:12}}>
          <div style={{fontSize:11,color:"#aaa",marginBottom:4}}>呼出番号</div>
          <div style={{fontSize:16,fontWeight:700,color:"#8b0000",background:"#fff5f5",borderRadius:8,padding:"10px 12px"}}>{memoPopup.callNo}</div>
        </div>}
        {memoPopup.note&&<div style={{marginBottom:12}}>
          <div style={{fontSize:11,color:"#aaa",marginBottom:4}}>メモ</div>
          <div style={{fontSize:13,color:"#555",background:"#faf8f5",borderRadius:8,padding:"10px 12px",lineHeight:1.7,whiteSpace:"pre-wrap"}}>{memoPopup.note}</div>
        </div>}
        <button style={{...S.cancelBtn,width:"100%",marginTop:8}} onClick={()=>setMemoPopup(null)}>閉じる</button>
      </div>
    </div>}
  </div>;
}

function CasesTab({month,cases,staffList,saveCases,showToast}){
  const names=stNames(staffList);
  const blank=()=>({date:toDay(),name:"",staff:names[0]||"",payment:"現金",amount:""});
  const [form,setForm]=useState(blank());const [editId,setEditId]=useState(null);
  const filtered=useMemo(()=>(cases||[]).filter(c=>c.date.startsWith(month)).sort((a,b)=>b.date.localeCompare(a.date)),[cases,month]);
  const total=filtered.reduce((s,c)=>s+c.amount,0);
  const cashT=filtered.filter(c=>c.payment==="現金").reduce((s,c)=>s+c.amount,0);
  const xferT=filtered.filter(c=>c.payment==="振込").reduce((s,c)=>s+c.amount,0);
  const handleSave=async()=>{
    if(!form.date||!form.name||!form.amount){showToast("⚠ 日付・名前・金額は必須");return;}
    const amt=Number(form.amount);if(!amt){showToast("⚠ 金額を入力");return;}
    if(editId){await saveCases((cases||[]).map(c=>c.id===editId?{...form,id:editId,amount:amt}:c));setEditId(null);showToast("✅ 更新");}
    else{await saveCases([{...form,id:Date.now(),amount:amt},...(cases||[])]);showToast("✅ 保存");}
    setForm(blank());
  };
  const startEdit=c=>{setForm({...c,amount:String(c.amount)});setEditId(c.id);};
  const del=async id=>{if(!confirm("削除しますか？"))return;await saveCases((cases||[]).filter(c=>c.id!==id));showToast("🗑 削除");};

  return <div style={{animation:"fadeUp .3s ease"}}>
    <div style={S.pills}><Pill label="合計" val={yen(total)} red/><Pill label="💴現金" val={yen(cashT)}/><Pill label="🏦振込" val={yen(xferT)}/></div>
    <div style={S.formCard}>
      <div style={S.formTitle}>{editId?"✏️ 編集":"➕ 案件売上を追加"}</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}>
        <FR label="日付"><input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></FR>
        <FR label="担当"><select value={form.staff} onChange={e=>setForm({...form,staff:e.target.value})}>{names.map(n=><option key={n}>{n}</option>)}</select></FR>
      </div>
      <FR label="案件名"><input type="text" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="林田様 カーテン設置"/></FR>
      <FR label="支払"><div style={{display:"flex",gap:8}}>{["現金","振込"].map(p=><button key={p} style={{...S.seg,...(form.payment===p?(p==="現金"?S.segCash:S.segXfer):{})}} onClick={()=>setForm({...form,payment:p})}>{p==="現金"?"💴 現金":"🏦 振込"}</button>)}</div></FR>
      <FR label="金額（円）"><input type="text" inputMode="numeric" value={form.amount} onChange={e=>{if(/^\d*$/.test(e.target.value))setForm({...form,amount:e.target.value});}} onFocus={e=>e.target.select()} placeholder="15000" style={{width:"100%"}}/></FR>
      <div style={{display:"flex",gap:8,marginTop:4}}>
        {editId&&<button style={S.cancelBtn} onClick={()=>{setEditId(null);setForm(blank());}}>キャンセル</button>}
        <button style={S.saveBtn} onClick={handleSave}>{editId?"更新":"保存"}</button>
      </div>
    </div>
    <div style={S.tableWrap}>
      {filtered.length===0?<div style={S.empty}>この月の案件はありません</div>:
      <table style={{tableLayout:"fixed",width:"100%"}}>
        <thead><tr>
          <th style={{width:54}}>日付</th>
          <th style={{textAlign:"left",width:"auto"}}>案件名</th>
          <th style={{width:30}}>担当</th>
          <th style={{width:30}}>支払</th>
          <th style={{textAlign:"right",width:62}}>金額</th>
          <th style={{width:40}}></th>
        </tr></thead>
        <tbody>{filtered.map(c=><tr key={c.id}>
          <td style={{fontSize:9,letterSpacing:"-0.5px",padding:"7px 2px"}}>{c.date.slice(5).replace("-","/")}</td>
          <td style={{textAlign:"left",wordBreak:"break-all",fontSize:11,padding:"7px 4px"}}>{c.name}</td>
          <td style={{textAlign:"center",padding:"7px 2px"}}><span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:20,height:20,borderRadius:"50%",background:"#f5eeee",color:"#8b0000",fontSize:10,fontWeight:700}}>{c.staff?c.staff[0]:"?"}</span></td>
          <td><span style={{...S.badge,...(c.payment==="現金"?S.bCash:S.bXfer)}}>{c.payment==="現金"?"現":"振"}</span></td>
          <td style={{textAlign:"right",fontWeight:700,color:"#2d6a4f"}}>{yen(c.amount)}</td>
          <td><button style={S.iconBtn} onClick={()=>startEdit(c)}>✏</button><button style={{...S.iconBtn,color:"#ddd"}} onClick={()=>del(c.id)}>✕</button></td>
        </tr>)}</tbody>
      </table>}
    </div>
  </div>;
}

function ClosingTab({month,props,staffList,cleanData,monthCntData,stayProps,stayClean,cases,cfg,saveCfg,showToast}){
  const [loc,setLoc]=useState(cfg);useEffect(()=>setLoc(cfg),[cfg]);
  const names=stNames(staffList);
  const getMc=pid=>monthCntData[mcKey(month,pid)]??(props.find(p=>p.id===pid)?.cnt||0);
  const getC=(pid,st)=>Number(cleanData[cdKey(month,pid,st)]||0);
  const getStayC=(pid,st)=>Number(stayClean[cdKey(month,pid,st)]||0);

  // 日常清掃集計
  const cleanBySt=useMemo(()=>{const m={};names.forEach(st=>m[st]=0);props.forEach(p=>{const counts={};names.forEach(st=>counts[st]=getC(p.id,st));const sales=calcStaffSales(p.fee,getMc(p.id),counts,names);names.forEach((st,i)=>m[st]=(m[st]||0)+sales[i]);});return m;},[month,props,cleanData,monthCntData,staffList]);

  // 宿泊清掃集計
  const stayBySt=useMemo(()=>{
    const m={};names.forEach(st=>m[st]=0);
    (stayProps||[]).forEach(p=>{
      const counts={};names.forEach(st=>counts[st]=getStayC(p.id,st));
      const sales=calcStayStaffSales(p.unitPrice,counts,names);
      names.forEach((st,i)=>m[st]=(m[st]||0)+sales[i]);
    });
    return m;
  },[month,stayProps,stayClean,staffList]);

  const caseBySt=useMemo(()=>{const filt=(cases||[]).filter(c=>c.date.startsWith(month));const m={};names.forEach(st=>m[st]={cash:0,xfer:0});filt.forEach(c=>{if(!m[c.staff])m[c.staff]={cash:0,xfer:0};if(c.payment==="現金")m[c.staff].cash+=c.amount;else m[c.staff].xfer+=c.amount;});return m;},[month,cases,staffList]);

  const stSales=useMemo(()=>{const m={};names.forEach(st=>m[st]=(cleanBySt[st]||0)+(stayBySt[st]||0)+(caseBySt[st]?.cash||0)+(caseBySt[st]?.xfer||0));return m;},[cleanBySt,stayBySt,caseBySt,staffList]);

  const total=names.reduce((s,st)=>s+(stSales[st]||0),0);
  const cleanTotal=names.reduce((s,st)=>s+(cleanBySt[st]||0),0);
  const stayTotal=names.reduce((s,st)=>s+(stayBySt[st]||0),0);
  const cashT=(cases||[]).filter(c=>c.date.startsWith(month)&&c.payment==="現金").reduce((s,c)=>s+c.amount,0);
  const caseXfer=(cases||[]).filter(c=>c.date.startsWith(month)&&c.payment==="振込").reduce((s,c)=>s+c.amount,0);
  const xferT=caseXfer+cleanTotal+stayTotal;

  const taxTargetNames=names.filter(st=>isTaxTarget(staffList.find(s=>toStaffObj(s).name===st)||st));
  const taxTargetTotal=taxTargetNames.reduce((s,st)=>s+(stSales[st]||0),0);
  const fixPct=total>0?(loc.fixedCost/total*100).toFixed(1):0;
  const taxAmt=Math.round(total*loc.taxRate/100);
  const deduct=loc.fixedCost+taxAmt;
  const remain=total-deduct;
  const remPct=total>0?(remain/total*100).toFixed(1):0;
  const salaries=useMemo(()=>{const m={};names.forEach(st=>{const isT=isTaxTarget(staffList.find(s=>toStaffObj(s).name===st)||st);m[st]=isT&&taxTargetTotal>0?Math.round(remain*(stSales[st]||0)/taxTargetTotal):null;});return m;},[remain,stSales,taxTargetTotal,staffList]);

  return <div style={{animation:"fadeUp .3s ease"}}>
    <div style={{...S.card,background:"linear-gradient(135deg,#7a0000,#c0392b)",color:"#fff",marginBottom:12}}>
      <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>📊 月末締め計算表 — {month}</div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
        {names.map(st=><div key={st} style={S.closingCard}>
          <div style={{fontSize:10,color:"rgba(255,255,255,0.6)",marginBottom:2}}>{st}売上</div>
          <div style={{fontWeight:700,fontSize:15}}>{yen(stSales[st]||0)}</div>
          <div style={{fontSize:10,color:"rgba(255,255,255,0.45)",marginTop:2}}>
            清掃 {yen(cleanBySt[st]||0)} / 宿泊 {yen(stayBySt[st]||0)} / 案件 {yen((caseBySt[st]?.cash||0)+(caseBySt[st]?.xfer||0))}
          </div>
        </div>)}
      </div>
      <div style={{display:"flex",gap:16,borderTop:"1px solid rgba(255,255,255,0.2)",paddingTop:10,flexWrap:"wrap"}}>
        <div><div style={{fontSize:10,color:"rgba(255,255,255,0.6)"}}>🏦 振込合計</div><b>{yen(xferT)}</b><div style={{fontSize:10,color:"rgba(255,255,255,0.45)"}}>清掃 {yen(cleanTotal)} + 宿泊 {yen(stayTotal)} + 案件 {yen(caseXfer)}</div></div>
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
      <div style={{borderTop:"2px solid #eee",marginTop:8,paddingTop:8,display:"flex",justifyContent:"space-between"}}><b>控除合計（{(Number(fixPct)+Number(loc.taxRate)).toFixed(1)}%）</b><span style={{color:"#c0392b",fontWeight:700}}>-{yen(deduct)}</span></div>
      <div style={{background:"#f0fdf4",borderRadius:10,padding:"10px 14px",marginTop:8,display:"flex",justifyContent:"space-between"}}><span style={{fontWeight:700,color:"#2d6a4f"}}>残額（{remPct}%）</span><span style={{fontWeight:700,color:"#2d6a4f",fontSize:18}}>{yen(remain)}</span></div>
    </div>
    <div style={S.card}>
      <div style={S.sTitle}>給与按分</div>
      {names.map(st=>{const isT=isTaxTarget(staffList.find(s=>toStaffObj(s).name===st)||st);const ratio=isT&&taxTargetTotal>0?((stSales[st]||0)/taxTargetTotal*100).toFixed(1):0;return <div key={st} style={{marginBottom:14,opacity:isT?1:0.75}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontWeight:700}}>👤 {st}給与</span>{!isT&&<span style={{fontSize:10,background:"#f0ece4",color:"#888",borderRadius:4,padding:"1px 6px"}}>固定費に含む</span>}</div>
          <div style={{textAlign:"right"}}>{isT?<><span style={{fontSize:11,color:"#aaa",marginRight:8}}>売上比 {ratio}%</span><span style={{fontWeight:700,fontSize:16,color:"#2d6a4f"}}>{yen(salaries[st]||0)}</span></>:<span style={{fontSize:13,color:"#aaa"}}>按分対象外</span>}</div>
        </div>
        {isT&&<div style={S.barBg}><div style={{...S.bar,width:ratio+"%"}}/></div>}
        <div style={{fontSize:10,color:"#aaa",marginTop:3}}>清掃 {yen(cleanBySt[st]||0)} ／ 宿泊 {yen(stayBySt[st]||0)} ／ 案件現金 {yen(caseBySt[st]?.cash||0)} ／ 案件振込 {yen(caseBySt[st]?.xfer||0)}</div>
      </div>;})}
      <div style={{borderTop:"2px solid #eee",paddingTop:10,display:"flex",justifyContent:"space-between"}}><b>給与合計（按分対象）</b><b style={{color:"#2d6a4f"}}>{yen(taxTargetNames.reduce((s,st)=>s+(salaries[st]||0),0))}</b></div>
      <p style={{fontSize:10,color:"#bbb",marginTop:6}}>※荒牧さん給与は固定費に含む ※山辺ボーナスはねこのて給与から支払い</p>
    </div>
  </div>;
}

function CfgTab({props,saveProps,staffList,saveStaff,cfg,saveCfg,password,savePassword,stayProps,saveStayProps,showToast}){
  const [lProps,setLProps]=useState(props);useEffect(()=>setLProps(props),[props]);
  const [lStaff,setLStaff]=useState(staffList.map(toStaffObj));useEffect(()=>setLStaff(staffList.map(toStaffObj)),[staffList]);
  const [lCfg,setLCfg]=useState(cfg);useEffect(()=>setLCfg(cfg),[cfg]);
  const [lStayProps,setLStayProps]=useState(stayProps||[]);useEffect(()=>setLStayProps(stayProps||[]),[stayProps]);

  const updPropStr=(id,k,v)=>setLProps(lProps.map(p=>p.id===id?{...p,[k]:v}:p));
  const updPropNum=(id,k,v)=>setLProps(lProps.map(p=>p.id===id?{...p,[k]:Number(v)}:p));
  const addProp=()=>setLProps([...lProps,{id:Date.now(),name:"",fee:0,cnt:1,address:"",callNo:"",note:""}]);
  const delProp=id=>{if(!confirm("削除しますか？"))return;setLProps(lProps.filter(p=>p.id!==id));};

  const updStayStr=(id,k,v)=>setLStayProps(lStayProps.map(p=>p.id===id?{...p,[k]:v}:p));
  const updStayNum=(id,k,v)=>setLStayProps(lStayProps.map(p=>p.id===id?{...p,[k]:Number(v)}:p));
  const addStayProp=()=>setLStayProps([...lStayProps,{id:Date.now(),name:"",unitPrice:0,type:"minpaku",address:"",note:""}]);
  const delStayProp=id=>{if(!confirm("削除しますか？"))return;setLStayProps(lStayProps.filter(p=>p.id!==id));};

  const toggleTax=i=>{const a=[...lStaff];a[i]={...a[i],taxTarget:!a[i].taxTarget};setLStaff(a);};
  const delStaff=i=>{if(!confirm("削除しますか？"))return;const a=[...lStaff];a.splice(i,1);setLStaff(a);};
  const saveAll=async()=>{
    await saveProps(lProps);
    await saveStaff(lStaff.filter(s=>s.name&&s.name.trim()));
    await saveCfg(lCfg);
    await saveStayProps(lStayProps);
    showToast("✅ 保存しました");
  };

  return <div style={{animation:"fadeUp .3s ease"}}>
    <div style={{...S.card,marginBottom:12}}>
      <div style={S.sTitle}>👥 スタッフ管理</div>
      {lStaff.map((s,i)=><div key={i} style={{display:"flex",gap:8,marginBottom:10,alignItems:"center",background:"#faf8f5",borderRadius:10,padding:"8px 10px"}}>
        <input type="text" value={s.name||""} onChange={e=>{const a=[...lStaff];a[i]={...a[i],name:e.target.value};setLStaff(a);}} placeholder="スタッフ名" style={{flex:1}}/>
        <div style={{display:"flex",alignItems:"center",gap:6,whiteSpace:"nowrap"}}>
          <span style={{fontSize:11,color:"#888"}}>控除対象</span>
          <div onClick={()=>toggleTax(i)} style={{width:42,height:24,borderRadius:12,cursor:"pointer",position:"relative",background:s.taxTarget!==false?"#2d6a4f":"#ccc",transition:"background .2s"}}>
            <div style={{position:"absolute",top:3,left:s.taxTarget!==false?20:3,width:18,height:18,borderRadius:"50%",background:"#fff",transition:"left .2s"}}/>
          </div>
        </div>
        <button style={{...S.iconBtn,color:"#e74c3c",fontSize:16}} onClick={()=>delStaff(i)}>✕</button>
      </div>)}
      <button style={S.cancelBtn} onClick={()=>setLStaff([...lStaff,{name:"",taxTarget:true}])}>＋ スタッフを追加</button>
    </div>

    <div style={{...S.card,marginBottom:12}}>
      <div style={S.sTitle}>🏠 物件マスタ（日常清掃）</div>
      <p style={{fontSize:11,color:"#aaa",marginBottom:10}}>月ごとの回数は日常清掃タブで変更できます</p>
      <div style={S.tableWrap}><table>
        <thead><tr>
          <th style={{textAlign:"left",minWidth:110}}>物件名</th>
          <th style={{minWidth:80}}>月額(円)</th>
          <th style={{minWidth:60}}>標準月回数</th>
          <th style={{textAlign:"left",minWidth:150}}>住所</th>
          <th style={{minWidth:70}}>呼出番号</th>
          <th style={{textAlign:"left",minWidth:100}}>備考</th>
          <th></th>
        </tr></thead>
        <tbody>{lProps.map(p=><tr key={p.id}>
          <td><input type="text" value={p.name} onChange={e=>updPropStr(p.id,"name",e.target.value)} style={{width:"100%"}}/></td>
          <td><NumInput value={p.fee} onCommit={v=>updPropNum(p.id,"fee",v)} style={{width:90}}/></td>
          <td><NumInput value={p.cnt} onCommit={v=>updPropNum(p.id,"cnt",Math.max(1,v))} min={1} style={{width:60}}/></td>
          <td><input type="text" value={p.address||""} onChange={e=>updPropStr(p.id,"address",e.target.value)} style={{width:"100%",minWidth:140}} placeholder="福岡市…"/></td>
          <td><input type="text" value={p.callNo||""} onChange={e=>updPropStr(p.id,"callNo",e.target.value)} style={{width:80}} placeholder="#101"/></td>
          <td><input type="text" value={p.note||""} onChange={e=>updPropStr(p.id,"note",e.target.value)} style={{width:"100%",minWidth:100}} placeholder="メモ"/></td>
          <td><button style={{...S.iconBtn,color:"#e74c3c"}} onClick={()=>delProp(p.id)}>✕</button></td>
        </tr>)}</tbody>
      </table></div>
      <button style={{...S.cancelBtn,marginTop:10}} onClick={addProp}>＋ 物件を追加</button>
    </div>

    <div style={{...S.card,marginBottom:12}}>
      <div style={S.sTitle}>🏨 宿泊清掃物件マスタ</div>
      <p style={{fontSize:11,color:"#aaa",marginBottom:10}}>民泊・マンスリーの物件を登録します。1回単価×回数で売上計算します。</p>
      {lStayProps.length===0
        ?<div style={{textAlign:"center",color:"#ccc",padding:"20px 0",fontSize:13}}>物件がありません。「＋ 物件を追加」から登録してください</div>
        :<div style={S.tableWrap}><table>
          <thead><tr>
            <th style={{textAlign:"left",minWidth:110}}>物件名</th>
            <th style={{minWidth:60}}>種別</th>
            <th style={{minWidth:90}}>1回単価(円)</th>
            <th style={{textAlign:"left",minWidth:150}}>住所</th>
            <th style={{textAlign:"left",minWidth:100}}>備考</th>
            <th></th>
          </tr></thead>
          <tbody>{lStayProps.map(p=><tr key={p.id}>
            <td><input type="text" value={p.name||""} onChange={e=>updStayStr(p.id,"name",e.target.value)} style={{width:"100%"}} placeholder="ゲストハウス〇〇"/></td>
            <td>
              <select value={p.type||"minpaku"} onChange={e=>updStayStr(p.id,"type",e.target.value)} style={{width:90}}>
                <option value="minpaku">民泊</option>
                <option value="monthly">マンスリー</option>
              </select>
            </td>
            <td><NumInput value={p.unitPrice||0} onCommit={v=>updStayNum(p.id,"unitPrice",v)} style={{width:90}}/></td>
            <td><input type="text" value={p.address||""} onChange={e=>updStayStr(p.id,"address",e.target.value)} style={{width:"100%",minWidth:140}} placeholder="福岡市…"/></td>
            <td><input type="text" value={p.note||""} onChange={e=>updStayStr(p.id,"note",e.target.value)} style={{width:"100%",minWidth:100}} placeholder="メモ"/></td>
            <td><button style={{...S.iconBtn,color:"#e74c3c"}} onClick={()=>delStayProp(p.id)}>✕</button></td>
          </tr>)}</tbody>
        </table></div>
      }
      <button style={{...S.cancelBtn,marginTop:10}} onClick={addStayProp}>＋ 物件を追加</button>
    </div>

    <div style={{...S.card,marginBottom:12}}>
      <div style={S.sTitle}>⚙️ 固定設定</div>
      <FR label="固定費（円）"><NumInput value={lCfg.fixedCost} onCommit={v=>setLCfg({...lCfg,fixedCost:v})} style={{width:140}}/></FR>
      <FR label="税貯金率（%）"><NumInput value={lCfg.taxRate} onCommit={v=>setLCfg({...lCfg,taxRate:v})} style={{width:100}}/></FR>
    </div>
    <button style={S.saveBtn} onClick={saveAll}>💾 すべて保存</button>
    <PwCard password={password} savePassword={savePassword} showToast={showToast}/>
  </div>;
}

function PwCard({password,savePassword,showToast}){
  const [cur,setCur]=useState("");const [next,setNext]=useState("");const [conf,setConf]=useState("");
  const change=async()=>{if(cur!==password){showToast("⚠ 現在のパスワードが違います");return;}if(!next){showToast("⚠ 新しいパスワードを入力");return;}if(next!==conf){showToast("⚠ 確認用が一致しません");return;}await savePassword(next);setCur("");setNext("");setConf("");showToast("✅ パスワードを変更しました");};
  return <div style={{...S.card,marginTop:12,border:"1.5px solid #fcc"}}>
    <div style={S.sTitle}>🔑 パスワード変更</div>
    <FR label="現在のパスワード"><input type="password" value={cur} onChange={e=>setCur(e.target.value)} placeholder="現在のパスワード"/></FR>
    <FR label="新しいパスワード"><input type="password" value={next} onChange={e=>setNext(e.target.value)} placeholder="新しいパスワード"/></FR>
    <FR label="新しいパスワード（確認）"><input type="password" value={conf} onChange={e=>setConf(e.target.value)} placeholder="もう一度入力"/></FR>
    <button style={{...S.saveBtn,background:"linear-gradient(135deg,#1a3a6e,#4a6fa5)"}} onClick={change}>🔑 パスワードを変更</button>
  </div>;
}

function FR({label,children}){return <div style={{marginBottom:10}}><div style={{fontSize:11,color:"#999",marginBottom:4}}>{label}</div>{children}</div>;}
function Pill({label,val,red}){return <div style={{background:red?"#c0392b":"#f5eeee",color:red?"#fff":"#777",borderRadius:20,padding:"5px 14px",fontSize:12,fontWeight:600}}>{label}：{val}</div>;}
function DRow({label,note,amt}){return <div style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid #f5eeee",fontSize:13}}><span style={{color:"#666"}}>{label} <span style={{color:"#bbb",fontSize:11}}>({note})</span></span><span style={{color:"#c0392b",fontWeight:600}}>-{yen(amt)}</span></div>;}

const css=`
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{background:#fdf8f5;font-family:'Noto Sans JP',sans-serif;-webkit-tap-highlight-color:transparent}
input,select,button,textarea{font-family:'Noto Sans JP',sans-serif}
input[type=text],input[type=date],input[type=month],input[type=password],input[type=tel],select{
  border:1.5px solid #e0d0d0;border-radius:8px;padding:7px 10px;
  background:#fff;font-size:13px;color:#333;outline:none;transition:border-color .2s;width:100%}
input:focus,select:focus{border-color:#c0392b}
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
  loginIcon:{fontSize:56,marginBottom:4},loginTitle:{fontSize:20,fontWeight:700,color:"#fff",letterSpacing:2},loginSub:{fontSize:11,color:"#884444",marginBottom:8},
  loginInput:{width:"100%",padding:"12px 16px",borderRadius:10,border:"1.5px solid #441111",background:"rgba(80,20,20,0.5)",color:"#fff",fontSize:15,outline:"none",textAlign:"center",letterSpacing:4},
  loginBtn:{width:"100%",padding:"13px 0",background:"linear-gradient(135deg,#a00,#e03)",color:"#fff",border:"none",borderRadius:10,fontSize:15,fontWeight:700,cursor:"pointer",marginTop:4},
  app:{minHeight:"100vh",background:"#fdf8f5"},
  header:{background:"linear-gradient(135deg,#7a0000,#c0392b)",color:"#fff",padding:"12px 16px",display:"flex",alignItems:"center",gap:8},
  hTitle:{fontWeight:700,fontSize:15,color:"#fff"},hSub:{fontSize:10,color:"rgba(255,255,255,0.6)"},
  logoutBtn:{background:"rgba(255,255,255,0.15)",border:"none",color:"rgba(255,255,255,0.7)",borderRadius:8,padding:"5px 12px",fontSize:11,cursor:"pointer"},
  tabs:{display:"flex",background:"#fff",borderBottom:"2px solid #fde8e8",overflowX:"auto"},
  tab:{padding:"10px 8px",background:"none",border:"none",fontSize:10,color:"#bbb",cursor:"pointer",fontWeight:500,whiteSpace:"nowrap",flexShrink:0},
  tabOn:{color:"#c0392b",borderBottom:"3px solid #e03030",fontWeight:700,background:"#fff8f8",padding:"10px 8px"},
  body:{padding:14,maxWidth:860,margin:"0 auto"},
  ctrlRow:{display:"flex",gap:10,alignItems:"center",marginBottom:12,flexWrap:"wrap"},
  pills:{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"},
  staffBar:{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"},
  staffCell:{flex:1,minWidth:100,background:"#fff5f5",borderRadius:10,padding:"10px 12px",border:"1px solid #fcc"},
  staffLabel:{fontSize:11,color:"#c44",marginBottom:3},staffAmt:{fontWeight:700,color:"#8b0000",fontSize:14},
  tableWrap:{background:"#fff",borderRadius:12,overflow:"auto",boxShadow:"0 2px 8px rgba(180,0,0,0.07)"},
  card:{background:"#fff",borderRadius:14,padding:16,boxShadow:"0 2px 8px rgba(180,0,0,0.07)",marginBottom:4},
  formCard:{background:"#fff",borderRadius:14,padding:"16px 16px",boxShadow:"0 2px 8px rgba(180,0,0,0.07)",marginBottom:12},
  formTitle:{fontWeight:700,fontSize:14,color:"#8b0000",marginBottom:12},
  seg:{flex:1,padding:"8px 0",background:"#f5f5f5",border:"1.5px solid #ddd",borderRadius:8,fontSize:12,cursor:"pointer",color:"#888"},
  segCash:{background:"#fef9c3",borderColor:"#f0b429",color:"#7a4f00",fontWeight:700},
  segXfer:{background:"#dbeafe",borderColor:"#3b82f6",color:"#1e3a8a",fontWeight:700},
  saveBtn:{width:"100%",padding:"12px 0",background:"linear-gradient(135deg,#7a0000,#c0392b)",color:"#fff",border:"none",borderRadius:10,fontSize:14,fontWeight:700,cursor:"pointer"},
  cancelBtn:{padding:"10px 18px",background:"#f5f5f5",border:"1.5px solid #ddd",borderRadius:10,fontSize:13,cursor:"pointer",color:"#666"},
  redBtn:{padding:"8px 16px",background:"#fff0f0",border:"1.5px solid #f9a8a8",borderRadius:8,fontSize:12,cursor:"pointer",color:"#c0392b",fontWeight:600},
  badge:{display:"inline-block",borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700},
  bCash:{background:"#fef9c3",color:"#7a4f00",borderRadius:"50%",width:26,height:26,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,border:"1.5px solid #f0b429"},bXfer:{background:"#dbeafe",color:"#1e3a8a"},
  iconBtn:{background:"none",border:"none",cursor:"pointer",fontSize:13,padding:"2px 5px",color:"#c88"},
  empty:{textAlign:"center",color:"#ccc",padding:40,fontSize:13},
  sTitle:{fontWeight:700,fontSize:14,color:"#8b0000",marginBottom:12},
  closingCard:{flex:1,minWidth:110,background:"rgba(255,255,255,0.15)",borderRadius:10,padding:"10px 12px"},
  barBg:{height:8,background:"#fee",borderRadius:8,overflow:"hidden"},
  bar:{height:"100%",borderRadius:8,background:"linear-gradient(90deg,#c0392b,#e74c3c)",transition:"width .5s"},
  toast:{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:"#7a0000",color:"#fff",borderRadius:12,padding:"12px 24px",fontSize:13,fontWeight:600,zIndex:999,animation:"toastAnim 2.5s ease forwards",whiteSpace:"nowrap",boxShadow:"0 4px 20px rgba(180,0,0,0.4)"},
  modalBg:{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:900},
  modal:{background:"#fff",borderRadius:"16px 16px 0 0",padding:"24px 20px",width:"100%",maxWidth:600,maxHeight:"90vh",overflowY:"auto"},
};

// ══════════════════════════════════════════
// 見積もりタブ
// ══════════════════════════════════════════
const PRICE_DATA = {
  house: {
    label:"🏠 ハウスクリーニング",
    items:[
      {key:"1R", label:"1R", price:10000},
      {key:"1DK", label:"1DK", price:11000},
      {key:"1LDK", label:"1LDK/2K", price:15000},
      {key:"2DK", label:"2DK", price:16000},
      {key:"2LDK", label:"2LDK/3K", price:18000},
      {key:"3DK", label:"3DK", price:19000},
      {key:"3LDK", label:"3LDK", price:24000},
      {key:"4DK", label:"4DK", price:25000},
      {key:"4LDK", label:"4LDK", price:30000},
      {key:"detached", label:"戸建（要相談）", price:null},
    ],
    options:[
      {key:"extra_room", label:"部屋追加（+1部屋）", price:6000, perUnit:true, unitLabel:"部屋"},
      {key:"detached_add", label:"分譲・戸建て追加", price:13000},
      {key:"travel", label:"出張費", price:2200},
    ]
  },
  bee: {
    label:"🐝 蜂の巣駆除",
    items:[
      {key:"ashinaga", label:"アシナガバチ", price:10000},
      {key:"suzume", label:"スズメバチ全般", price:15000},
      {key:"keiro", label:"キイロスズメバチ", price:20000},
    ],
    options:[
      {key:"size_10_15", label:"巣サイズ 10-15cm", price:3000},
      {key:"size_15_20", label:"巣サイズ 15-20cm〜", price:6000},
      {key:"height", label:"高所・難所追加", price:3000},
      {key:"travel", label:"出張費", price:2200},
    ]
  },
  hourly: {
    label:"⏰ 時間工賃",
    items:[],
    options:[
      {key:"hour", label:"作業時間（1時間）", price:3300, perUnit:true, unitLabel:"時間"},
      {key:"travel", label:"出張費", price:2200},
      {key:"staff", label:"スタッフ追加（+1名）", price:3300, perUnit:true, unitLabel:"名"},
    ]
  },
  pesticide: {
    label:"🪲 薬剤散布（ゴキブリ等）",
    items:[],
    options:[
      {key:"tech", label:"技術料", price:3300},
      {key:"material", label:"資材費", price:3300},
      {key:"travel", label:"出張費", price:2200},
    ]
  },
};

function EstimateTab({jobs,saveJobs,staffList,setTab,showToast}){
  const names = stNames(staffList);
  const [category,setCategory]=useState("house");
  const [selectedItem,setSelectedItem]=useState(null);
  const [optionCounts,setOptionCounts]=useState({});
  const [memo,setMemo]=useState("");
  const [client,setClient]=useState("");
  const [staff,setStaff]=useState(names[0]||"");
  const [workDate,setWorkDate]=useState("");

  const cat = PRICE_DATA[category];
  const resetForm=()=>{setSelectedItem(null);setOptionCounts({});setMemo("");};
  const changeCategory=(k)=>{setCategory(k);resetForm();};

  const basePrice = selectedItem?.price||0;
  const optTotal = Object.entries(optionCounts).reduce((sum,[key,cnt])=>{
    const opt=cat.options.find(o=>o.key===key);
    if(!opt||!cnt)return sum;
    return sum+(opt.perUnit?opt.price*cnt:opt.price);
  },0);
  const grandTotal = basePrice+optTotal;

  const setOptCount=(key,delta)=>{
    setOptionCounts(prev=>{
      const cur=prev[key]||0;
      const next=Math.max(0,cur+delta);
      return {...prev,[key]:next};
    });
  };
  const toggleOption=(key)=>{
    setOptionCounts(prev=>{
      if(prev[key])return {...prev,[key]:0};
      return {...prev,[key]:1};
    });
  };

  const saveAsJob=async()=>{
    if(!client){showToast("⚠ 依頼者を入力してください");return;}
    const lines=[`【見積】${cat.label}`];
    if(selectedItem)lines.push(`  ${selectedItem.label}：${yen(selectedItem.price||0)}`);
    cat.options.forEach(o=>{
      const cnt=optionCounts[o.key]||0;
      if(!cnt)return;
      lines.push(`  ${o.label}${o.perUnit?` ×${cnt}`:""}：${yen(o.perUnit?o.price*cnt:o.price)}`);
    });
    lines.push(`  合計：${yen(grandTotal)}`);
    if(memo)lines.push(`  メモ：${memo}`);
    const nj={
      id:Date.now(),client,content:lines[0],
      status:"見積済",workDate,staff,address:"",phone:"",payment:"振込",
      amount:grandTotal,memo:lines.slice(1).join("\n"),
      createdAt:Date.now(),isNew:true
    };
    await saveJobs([nj,...(jobs||[])]);
    showToast("✅ 案件タブに見積を追加しました");
    setTab("jobs");
  };

  return <div style={{animation:"fadeUp .3s ease"}}>
    <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
      {Object.entries(PRICE_DATA).map(([k,v])=>(
        <button key={k} onClick={()=>changeCategory(k)} style={{
          padding:"7px 14px",borderRadius:20,border:"1.5px solid",fontSize:12,cursor:"pointer",fontWeight:600,
          background:category===k?"#c0392b":"#fff",color:category===k?"#fff":"#888",borderColor:category===k?"#c0392b":"#ddd"
        }}>{v.label}</button>
      ))}
    </div>

    {cat.items.length>0&&<div style={{...S.card,marginBottom:12}}>
      <div style={S.sTitle}>基本料金を選択</div>
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {cat.items.map(item=>(
          <div key={item.key} onClick={()=>setSelectedItem(selectedItem?.key===item.key?null:item)}
            style={{padding:"10px 14px",borderRadius:10,border:`1.5px solid ${selectedItem?.key===item.key?"#c0392b":"#e0d0d0"}`,
              background:selectedItem?.key===item.key?"#fff5f5":"#fff",cursor:"pointer",
              display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontWeight:600,fontSize:13}}>{item.label}</span>
            <span style={{color:item.price?"#2d6a4f":"#aaa",fontWeight:700,fontSize:13}}>
              {item.price?yen(item.price):"要相談"}
            </span>
          </div>
        ))}
      </div>
    </div>}

    {cat.options.length>0&&<div style={{...S.card,marginBottom:12}}>
      <div style={S.sTitle}>オプション</div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {cat.options.map(opt=>{
          const cnt=optionCounts[opt.key]||0;
          return <div key={opt.key} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid #f5eeee"}}>
            <div>
              <div style={{fontSize:13,fontWeight:500}}>{opt.label}</div>
              <div style={{fontSize:11,color:"#aaa"}}>{yen(opt.price)}{opt.perUnit?"/"+opt.unitLabel:""}</div>
            </div>
            {opt.perUnit
              ?<div style={{display:"flex",alignItems:"center",gap:8}}>
                <button onClick={()=>setOptCount(opt.key,-1)} style={{...S.cancelBtn,padding:"4px 10px",fontSize:14}}>－</button>
                <span style={{minWidth:24,textAlign:"center",fontWeight:700}}>{cnt}</span>
                <button onClick={()=>setOptCount(opt.key,1)} style={{...S.cancelBtn,padding:"4px 10px",fontSize:14}}>＋</button>
              </div>
              :<div onClick={()=>toggleOption(opt.key)} style={{width:42,height:24,borderRadius:12,cursor:"pointer",position:"relative",background:cnt?"#c0392b":"#ccc",transition:"background .2s",flexShrink:0}}>
                <div style={{position:"absolute",top:3,left:cnt?20:3,width:18,height:18,borderRadius:"50%",background:"#fff",transition:"left .2s"}}/>
              </div>
            }
          </div>;
        })}
      </div>
    </div>}

    <div style={{...S.card,marginBottom:12,background:"linear-gradient(135deg,#f0fdf4,#dcfce7)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontWeight:700,fontSize:15,color:"#166534"}}>見積合計</span>
        <span style={{fontWeight:700,fontSize:24,color:"#166534"}}>{yen(grandTotal)}</span>
      </div>
      {grandTotal>0&&<div style={{marginTop:8,fontSize:11,color:"#4ade80"}}>
        {selectedItem&&<div>{selectedItem.label}：{yen(selectedItem.price||0)}</div>}
        {cat.options.filter(o=>optionCounts[o.key]>0).map(o=>(
          <div key={o.key}>{o.label}{o.perUnit?` ×${optionCounts[o.key]}`:""}：{yen(o.perUnit?o.price*(optionCounts[o.key]||0):o.price)}</div>
        ))}
      </div>}
    </div>

    <div style={{...S.card,marginBottom:12}}>
      <div style={S.sTitle}>案件として保存</div>
      <FR label="依頼者"><input type="text" value={client} onChange={e=>setClient(e.target.value)} placeholder="鳥井さん"/></FR>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}>
        <FR label="作業日"><input type="date" value={workDate} onChange={e=>setWorkDate(e.target.value)}/></FR>
        <FR label="担当"><select value={staff} onChange={e=>setStaff(e.target.value)}>{names.map(n=><option key={n}>{n}</option>)}</select></FR>
      </div>
      <FR label="メモ"><textarea value={memo} onChange={e=>setMemo(e.target.value)} rows={2} style={{width:"100%",border:"1.5px solid #e0d0d0",borderRadius:8,padding:"7px 10px",fontSize:13,resize:"vertical",outline:"none"}} placeholder="備考・注意事項など"/></FR>
      <button style={S.saveBtn} onClick={saveAsJob}>📋 案件タブに見積を追加</button>
    </div>
  </div>;
}
