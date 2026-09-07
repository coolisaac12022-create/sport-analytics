const pool=require('../config/db');
const api=require('./sportsApi');

function status(s){
  const c=s?.short||s;
  if(['FT','AET','PEN'].includes(c)) return 'finished';
  if(['1H','HT','2H','ET','P','LIVE','BT'].includes(c)) return 'live';
  return 'scheduled';
}

async function save(ev){
  const f=ev.fixture||{},l=ev.league||{},h=ev.teams?.home||{},a=ev.teams?.away||{},g=ev.goals||{};
  if(!f.id||!h.name||!a.name||!f.date)return false;
  const st=status(f.status),hs=g.home!=null?Number(g.home):null,as=g.away!=null?Number(g.away):null;

  const r=await pool.query(
    `INSERT INTO matches(external_id,league,season,home_team_name,away_team_name,match_date,status,home_score,away_score)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT(external_id) DO UPDATE SET league=EXCLUDED.league,season=EXCLUDED.season,home_team_name=EXCLUDED.home_team_name,away_team_name=EXCLUDED.away_team_name,match_date=EXCLUDED.match_date,status=EXCLUDED.status,home_score=EXCLUDED.home_score,away_score=EXCLUDED.away_score
     RETURNING id,home_team_name,away_team_name,elo_processed`,
    [String(f.id),l.name||'Unknown',l.season||null,h.name,a.name,f.date,st,hs,as]);

  if(h.logo)await badge(h.name,h.logo);
  if(a.logo)await badge(a.name,a.logo);

  const m=r.rows[0];
  if(st==='finished'&&hs!==null&&as!==null&&!m.elo_processed){
    try{
      const {updateEloAfterMatch}=require('./eloRating');
      await updateEloAfterMatch(m.home_team_name,m.away_team_name,hs,as);
      await pool.query('UPDATE matches SET elo_processed=TRUE WHERE id=$1',[m.id]);
    }catch(e){console.error('Erreur ELO : '+e.message);}
  }
  return true;
}

async function syncLeague(id){
  const events=await api.getUpcomingMatchesByLeague(id);
  let n=0;
  for(const e of events)try{if(await save(e))n++;}catch(x){console.error('Erreur match : '+x.message);}
  return n;
}

function dates(d){
  return d.toISOString().slice(0,10);
}

async function syncDate(date){
  const events=await api.getFixturesByDate(date);
  let n=0;
  for(const e of events)try{if(await save(e))n++;}catch(x){console.error('Erreur match : '+x.message);}
  return n;
}

async function autoSyncAllLeagues(){
  let n=0;
  for(let i=0;i<=7;i++){
    const d=new Date();
    d.setUTCDate(d.getUTCDate()+i);
    try{
      const x=await syncDate(dates(d));
      n+=x;
      console.log('Synchronisation '+dates(d)+' : '+x+' match(s).');
    }catch(e){console.error('Erreur sync '+dates(d)+' : '+e.message);}
  }
  return n;
}

async function updateFinishedResults(){
  let n=0;
  for(let i=1;i>=0;i--){
    const d=new Date();
    d.setUTCDate(d.getUTCDate()-i);
    try{
      const events=await api.getFixturesByDate(dates(d));
      for(const e of events)
        if(status(e.fixture?.status)==='finished'&&e.goals?.home!=null&&e.goals?.away!=null)
          if(await save(e))n++;
    }catch(e){console.error('Erreur résultats : '+e.message);}
  }
  return n;
}

async function badge(name,url){
  if(!name||!url)return;
  try{
    await pool.query(
      `INSERT INTO teams(name,logo_url) VALUES($1,$2)
       ON CONFLICT(name) DO UPDATE SET logo_url=EXCLUDED.logo_url`,
      [name,url]
    );
  }catch(e){console.error('Erreur logo : '+e.message);}
}

function getConfiguredLeagueIds(){
  return (process.env.AUTO_SYNC_LEAGUE_IDS||'39,140,135,78,61,2,3,94,88,203,207,179,128')
    .split(',').map(x=>x.trim()).filter(Boolean);
}

module.exports={syncLeague,autoSyncAllLeagues,getConfiguredLeagueIds,updateFinishedResults,cacheTeamBadge:badge};
