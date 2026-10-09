/* Public GitHub expense records; writes are confirmed by the visitor on GitHub. */
(function(global){
  'use strict';
  let adapter, latest=null, refreshing=false;
  function status(message){const node=document.getElementById('github-sync-status');if(node)node.textContent=message;}
  async function refresh(){
    if(refreshing)return;
    refreshing=true;document.querySelectorAll('[data-shared-write]').forEach(b=>b.disabled=true);
    status('GitHub 공금 기록을 불러오는 중입니다.');
    try{
      const state=await adapter.load();latest=state;
      currentExpenses=state.expenses;currentMemberCount=state.memberCount;
      document.getElementById('member-slider').value=currentMemberCount;
      document.getElementById('slider-count-display').textContent=`현재 ${currentMemberCount}명`;
      renderBudgetScreen();
      status('GitHub 공동 기록을 불러왔습니다. 변경 등록 후 다시 불러오기를 눌러주세요.');
    }catch(error){status((latest?'이전 조회 결과를 표시합니다. ':'공동 기록 조회 실패 · 초기 예산을 표시합니다. ')+error.message);}
    finally{refreshing=false;document.querySelectorAll('[data-shared-write]').forEach(b=>b.disabled=!latest);}
  }
  function submit(record){
    if(!latest){showToastMsg('공동 기록을 먼저 불러와주세요.');return;}
    try{global.location.assign(adapter.submissionURL(record));}catch(error){showToastMsg(error.message);}
  }
  global.saveExpenses=function(){status('인원·항목 변경은 저장 전입니다. GitHub에 변경 등록을 눌러주세요.');};
  const changeCount=global.changeMemberCount;
  global.changeMemberCount=function(value){changeCount(value);global.saveExpenses();};
  const calculate=global.calculateBudget;
  global.calculateBudget=function(){
    calculate();const node=document.getElementById('shared-pool-total');
    if(node)node.textContent=`${currentMemberCount}인 총 ${(currentMemberCount*200000).toLocaleString()}원`;
  };
  global.refreshSharedTrip=refresh;
  global.publishSharedBudget=function(){submit({version:1,kind:'budget',memberCount:currentMemberCount,expenses:currentExpenses});};
  global.openAddExpenseModal=function(){document.getElementById('modal-add-expense').classList.remove('opacity-0','pointer-events-none');};
  global.saveNewExpenseItem=function(){
    const title=document.getElementById('new-expense-title').value.trim();
    const amount=document.getElementById('new-expense-amount').value.trim();
    if(!amount){showToastMsg('금액을 입력해주세요.');return;}
    submit({version:1,kind:'expense',expense:{id:'expense_'+Date.now(),title,cost:Number(amount),checked:true}});
  };
  global.addEventListener('DOMContentLoaded',()=>{adapter=new global.TripGitHubAdapter(global.SHARED_TRIP_CONFIG);refresh();});
})(window);
