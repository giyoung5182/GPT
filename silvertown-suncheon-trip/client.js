/* Interface bindings for adapter.js. Configure SHARED_TRIP_CONFIG before loading. */
(function(global){
  'use strict';
  let adapter, latest=null, refreshing=false;
  function status(message){const node=document.getElementById('github-sync-status');if(node)node.textContent=message;}
  async function refresh(){
    if(refreshing)return;refreshing=true;status('GitHub 기록을 불러오는 중입니다.');
    try{
      const state=await adapter.load();latest=state;
      currentExpenses=state.expenses;currentMemberCount=state.memberCount;
      albumPosts=state.albums.map(p=>({...p,placeName:p.placeName||(PLACES_DATA.find(x=>x.id===p.placeId)||{}).name||'여행 기록'}));
      document.getElementById('member-slider').value=currentMemberCount;
      document.getElementById('slider-count-display').textContent=`현재 ${currentMemberCount}명`;
      renderBudgetScreen();renderAlbumFeed();
      status('GitHub 공동 기록을 불러왔습니다. 등록 후 다시 불러오기를 눌러주세요.');
    }catch(error){status((latest?'이전 조회 결과를 표시하고 있습니다. ':'공동 기록을 아직 불러오지 못했습니다. ')+error.message);}
    finally{refreshing=false;}
  }
  function submit(record){
    if(!latest){showToastMsg('공동 기록을 먼저 불러와주세요.');return;}
    try{const url=adapter.submissionURL(record);global.location.assign(url);}catch(error){showToastMsg(error.message);}
  }
  global.refreshSharedTrip=refresh;
  global.publishSharedBudget=function(){submit({version:1,kind:'budget',memberCount:currentMemberCount,expenses:currentExpenses});};
  global.openAddAlbumModal=function(){document.getElementById('modal-add-album').classList.remove('opacity-0','pointer-events-none');};
  global.saveAlbumPost=function(){
    const content=document.getElementById('album-content-input').value.trim();
    if(!content){showToastMsg('후기를 작성해주세요. 사진은 다음 GitHub 화면에서 첨부합니다.');return;}
    submit({version:1,kind:'album',placeId:document.getElementById('new-album-place-select').value,content});
  };
  global.openAddExpenseModal=function(){document.getElementById('modal-add-expense').classList.remove('opacity-0','pointer-events-none');};
  global.saveNewExpenseItem=function(){
    const title=document.getElementById('new-expense-title').value.trim();const cost=Number(document.getElementById('new-expense-amount').value);
    submit({version:1,kind:'expense',expense:{id:'expense_'+Date.now(),title,cost,checked:true}});
  };
  function openIssue(postId){const post=albumPosts.find(x=>x.id===postId);if(post&&post.issueUrl&&/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/issues\/\d+$/.test(post.issueUrl))global.location.assign(post.issueUrl);}
  global.likeAlbumPost=openIssue;global.addCommentToPost=openIssue;
  global.addEventListener('DOMContentLoaded',()=>{adapter=new global.TripGitHubAdapter(global.SHARED_TRIP_CONFIG);refresh();});
})(window);
