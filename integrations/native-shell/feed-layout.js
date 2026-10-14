// Native feed composition. Measurements happen on content/viewport changes only.
const COMPACT_HEIGHTS=[244,210,252,224,208,238,216,258,228,218,276,240,220,208,236,242,222,248];
export function feedProfile({viewportWidth,contentWidth,rootFontSize=16}){
 const compact=viewportWidth<=650,font=Number.isFinite(rootFontSize)&&rootFontSize>0?rootFontSize:16;
 const gap=compact?12:viewportWidth<=1000?18:20;
 const columns=compact?(viewportWidth<=300||contentWidth<2*9.3*font+gap?1:2):viewportWidth<=1000?2:3;
 return{compact,columns,gap,rootFontSize:font};
}
export function previewHeight(record,index,profile,measuredHeight=0){
 const authored=profile.compact?COMPACT_HEIGHTS[index%COMPACT_HEIGHTS.length]*(profile.rootFontSize/16):(record.baseHeight??record.height);
 return Math.ceil(Math.max(authored,measuredHeight+2)/4)*4;
}
export function balanceEntries(entries,{columns,category='all',gap=20}){
 const weights=Array(columns).fill(0),buckets=Array.from({length:columns},()=>[]);
 for(const entry of entries){const record=entry.record||entry,included=category==='all'||record.category===category;const column=weights.indexOf(Math.min(...weights));buckets[column].push(entry);if(included)weights[column]+=(entry.previewHeight??record.height)+gap;}
 return{buckets,weights};
}
