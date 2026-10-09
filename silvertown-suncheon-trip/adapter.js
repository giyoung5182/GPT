/* Shared GitHub records. Reading is anonymous; submitting opens GitHub for the user's confirmation. */
(function (global) {
  'use strict';
  const MARKER = '<!-- shared-trip-record:v1 -->';
  const clone = value => JSON.parse(JSON.stringify(value));
  function expenseValid(e) {
    return e && typeof e.id === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(e.id) &&
      typeof e.title === 'string' && e.title.length > 0 && e.title.length <= 120 &&
      Number.isSafeInteger(e.cost) && e.cost >= 0 && e.cost <= 100000000 && typeof e.checked === 'boolean';
  }
  function recordValid(r) {
    if (!r || r.version !== 1) return false;
    if (r.kind === 'expense') return expenseValid(r.expense);
    if (r.kind === 'budget') return Number.isInteger(r.memberCount) && r.memberCount >= 1 && r.memberCount <= 20 &&
      Array.isArray(r.expenses) && r.expenses.length <= 200 && r.expenses.every(expenseValid) &&
      new Set(r.expenses.map(e => e.id)).size === r.expenses.length;
    if (r.kind === 'album') return typeof r.placeId === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(r.placeId) &&
      typeof r.content === 'string' && r.content.length > 0 && r.content.length <= 2000;
    return false;
  }
  function parseRecord(body) {
    if (typeof body !== 'string' || body.length > 100000 || !body.startsWith(MARKER)) return null;
    const match = body.match(/```json\s*([\s\S]*?)\s*```/);
    try { const r = JSON.parse(match && match[1]); return recordValid(r) ? r : null; } catch { return null; }
  }
  function safePhoto(body) {
    const candidates = String(body || '').match(/https:\/\/(?:github\.com\/user-attachments\/assets\/|user-images\.githubusercontent\.com\/)[^\s)<>"']+/g);
    return candidates ? candidates[0] : null;
  }
  function applyIssues(initial, issues) {
    const state = clone(initial);
    state.albums = Array.isArray(state.albums) ? state.albums : [];
    state.expenses = Array.isArray(state.expenses) ? state.expenses.filter(expenseValid) : [];
    issues.filter(i => !i.pull_request && i.state === 'open').sort((a,b) => a.number-b.number).forEach(issue => {
      const r = parseRecord(issue.body);
      if (!r) return;
      if (r.kind === 'expense') {
        const e = {...r.expense, id:'issue_'+issue.number};
        state.expenses.push(e);
      } else if (r.kind === 'budget') {
        state.memberCount = r.memberCount;
        state.expenses = clone(r.expenses);
      } else {
        state.albums.unshift({id:'issue_'+issue.number, placeId:r.placeId, content:r.content,
          author:issue.user && issue.user.login || 'GitHub', photo:safePhoto(issue.body),
          timeAgo:issue.created_at, likes:issue.reactions && issue.reactions.heart || 0,
          commentsCount:issue.comments || 0, comments:[], issueUrl:issue.html_url});
      }
    });
    return state;
  }
  class TripGitHubAdapter {
    constructor({repository, dataPath, fetchImpl=global.fetch.bind(global)}) {
      if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) throw Error('Invalid repository');
      if (!/^[A-Za-z0-9_./-]+\.json$/.test(dataPath) || dataPath.includes('..')) throw Error('Invalid data path');
      this.repository=repository;this.dataPath=dataPath;this.fetch=fetchImpl;this.lastSuccess=null;
    }
    async request(url, headers={}) {
      const abort=new AbortController();const timer=setTimeout(()=>abort.abort(),15000);
      try {
        const res=await this.fetch(url,{cache:'no-store',headers:{Accept:'application/vnd.github+json',...headers},signal:abort.signal});
        if (!res.ok) throw Error(res.status===403||res.status===429 ? 'GitHub 조회 한도를 초과했습니다. 잠시 후 다시 불러와주세요.' : 'GitHub 데이터를 불러오지 못했습니다 ('+res.status+').');
        return await res.json();
      } finally {clearTimeout(timer);}
    }
    async load() {
      const base='https://api.github.com/repos/'+this.repository;
      const initial=await this.request(base+'/contents/'+this.dataPath,{Accept:'application/vnd.github.raw+json'});
      if (initial.schemaVersion!==1 || !Array.isArray(initial.expenses) || !initial.expenses.every(expenseValid) ||
          !Array.isArray(initial.albums) || !Number.isInteger(initial.memberCount) || initial.memberCount<1 || initial.memberCount>20)
        throw Error('저장된 데이터 형식을 확인해주세요.');
      const issues=[];
      for(let page=1;page<=10;page++) {
        const chunk=await this.request(base+'/issues?state=open&sort=created&direction=asc&per_page=100&page='+page);
        if(!Array.isArray(chunk)) throw Error('기록 목록 형식이 올바르지 않습니다.');
        issues.push(...chunk);
        if(chunk.length<100) break;
        if(page===10) throw Error('기록이 많아 전체를 불러오지 못했습니다. 저장소 관리자에게 정리를 요청해주세요.');
      }
      const result=applyIssues(initial,issues);this.lastSuccess=new Date().toISOString();return result;
    }
    submissionURL(record) {
      if(!recordValid(record)) throw Error('등록할 내용을 확인해주세요.');
      const title='[여행기록] '+({album:'사진·후기',expense:'지출',budget:'공금 상태'}[record.kind]);
      const body=MARKER+'\n```json\n'+JSON.stringify(record,null,2)+'\n```\n\n'+
        '사진은 이 아래에 첨부해주세요. 위 데이터 블록은 유지해주세요.\n';
      const url='https://github.com/'+this.repository+'/issues/new?'+new URLSearchParams({title,body});
      if(url.length>7500) throw Error('내용이 너무 깁니다. 내용을 줄여서 등록해주세요.');
      return url;
    }
  }
  TripGitHubAdapter.parseRecord=parseRecord;
  TripGitHubAdapter.applyIssues=applyIssues;
  TripGitHubAdapter.recordValid=recordValid;
  global.TripGitHubAdapter=TripGitHubAdapter;
})(typeof window==='undefined'?globalThis:window);
