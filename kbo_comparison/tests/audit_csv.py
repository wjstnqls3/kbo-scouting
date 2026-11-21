"""원본 파일에서 독립 계산 후 JS 엔진과 대조. 외부 네트워크 불필요."""
import csv,json,subprocess,collections,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
rows=list(csv.DictReader((ROOT/'kbo_batting_stats_season_1982-2026.csv').open(encoding='utf-8-sig')))
packaged=json.loads((ROOT/'sample_data.json').read_text())
assert len(rows)==len(packaged)
for raw,record in zip(rows,packaged):
 assert all(raw[k]==v for k,v in record.items()), 'CSV와 실행 JSON 불일치'
metadata=json.loads((ROOT/'data_metadata.json').read_text())
assert metadata['sha256']==hashlib.sha256((ROOT/metadata['source_file']).read_bytes()).hexdigest()
js=json.loads(subprocess.check_output(['node','-e',"const e=require('./analytics.js').create(require('./sample_data.json')); console.log(JSON.stringify({audit:e.audit,rows:e.rows.map(r=>({id:r.id,year:r.year,...r.stats,index:r.index})),league:Object.fromEntries(e.league)}))"],cwd=ROOT))
keys={(r['id'],r['year']) for r in js['rows']}; groups=collections.defaultdict(list)
for r in rows:
 if (r['Id'],int(r['Season'])) in keys: groups[int(r['Season'])].append(r)
def calc(rs):
 s={k:sum(int(r[k]) for r in rs) for k in ['H','AB','TB','BB','HBP','SF','PA','SO','HR','2B','3B','R']}
 den=s['AB']+s['BB']+s['HBP']+s['SF']
 avg=s['H']/s['AB'] if s['AB'] else None
 slg=s['TB']/s['AB'] if s['AB'] else None
 obp=(s['H']+s['BB']+s['HBP'])/den if den else None
 single=s['H']-s['2B']-s['3B']-s['HR']
 woba=(.758*s['BB']+.773*s['HBP']+.928*single+1.301*s['2B']+1.692*s['3B']+1.998*s['HR'])/den if den else None
 return dict(pa=s['PA'],avg=avg,obp=obp,slg=slg,ops=obp+slg if obp is not None and slg is not None else None,
             iso=slg-avg if avg is not None else None,bb=s['BB']/s['PA'],k=s['SO']/s['PA'],hr=s['HR']/s['PA'],woba=woba,rpa=s['R']/s['PA'])
def same(expected,actual):
 if expected is None:assert actual is None
 else:assert actual is not None and abs(expected-actual)<1e-10,(expected,actual)
leagues={year:calc(rs) for year,rs in groups.items()}
for year,values in leagues.items():
 for key,value in values.items():same(value,js['league'][str(year)][key])
original={(r['Id'],int(r['Season'])):r for r in rows}
for r in js['rows']:
 expected=calc([original[(r['id'],r['year'])]])
 for key,value in expected.items():
  if key!='rpa':same(value,r[key])
 lg=leagues[r['year']]
 same(expected['ops']/lg['ops']*100 if expected['ops'] is not None else None,r['index'])
 wrc=((expected['woba']-lg['woba'])/1.1406+lg['rpa'])*expected['pa'] if expected['woba'] is not None else None
 same(wrc,r['wrc']);same(wrc/expected['pa']*100 if wrc is not None else None,r['wrcPer100'])
names=collections.defaultdict(set)
for r in rows:names[r['Player']].add(r['Id'])
report={'columns':list(rows[0]),'raw_rows':len(rows),'engine_audit':js['audit'],'independent_verified_player_seasons':len(js['rows']),'verified_leagues':len(groups),'same_name_groups':sum(len(x)>1 for x in names.values()),'age_discrepancies':[{'id':r['Id'],'name':r['Player'],'season':r['Season'],'age':r['Age'],'born':r['Born']} for r in rows if int(r['Age'])!=int(r['Season'])-int(r['Born'][:4])],'season_2026_status':'미확인: 원출처·수집일·완료 상태가 메타데이터에 없음'}
report['verified_metrics']=['PA','AVG','OBP','SLG','OPS','ISO','BB%','K%','HR%','wOBA','OPS index','estimated wRC','wRC per 100 PA']
(ROOT/'docs/data-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(f"원본 대조: {len(js['rows'])}개 선수-시즌 13개 지표, {len(groups)}개 리그 합산 일치 · CSV/JSON/해시 일치")
