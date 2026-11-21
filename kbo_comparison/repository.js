(function(root){
  root.KBORepository={async load(){
    const bundled=()=>{
      const records=typeof battingData==='undefined'?null:battingData;
      if(!Array.isArray(records)||!records.length)throw Error('동봉된 선수 기록이 없습니다.');
      return {records,metadata:typeof battingMetadata==='undefined'?{}:battingMetadata};
    };
    if(location.protocol==='file:')return bundled();
    const response=await fetch('api/players');
    // Static hosting has no API. Real API errors must remain visible.
    if([404,405].includes(response.status))return bundled();
    if(!response.ok)throw Error('선수 API 요청 실패');
    const records=await response.json();let metadata={};
    try{const r=await fetch('data_metadata.json');if(r.ok)metadata=await r.json();}catch{}
    if(!Array.isArray(records)||!records.length)throw Error('선수 기록이 없습니다.');
    return {records,metadata};
  }};
})(globalThis);
