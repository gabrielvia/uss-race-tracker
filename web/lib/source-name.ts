// The user confirmed that stars in this reviewed MASA protocol mark female
// skaters. They are source annotations, while original evidence stays literal.
export const MASA_NAME_SOURCE = "2671f997837bdc170dfc1fc995fbe9431ea30df968678e51e62d350a72440ae2";
const WASHINGTON_NAME_SOURCE = "716413b7d201011fadfe2af999c87172ea1dfe36b4985083fca155061d58ce24";
const ST_LOUIS_NAME_SOURCE = "5dfc2f820dcf8e7f434a4fc2e097e7808f0b6d995e1257f9a25cf04f7f5e3e71";
const OHIO_NAME_SOURCE = "7064a19fde1e357d553cbd1cae5ed3fd4112553ee9aa10b5e91940244e3906dc";
const PRESIDENTIAL_NAME_SOURCE = "be4ae183f2b061e0b93b4b477183c16ed7388cf4322945a687f3d030bdaa00e4";
const JANUARY_THAW_NAME_SOURCE = "45c8361aeabeea5e23fd48392a8f4b3e06b411c9a214a036fa54d8f275ac20c8";
const ROBBY_KAUFMAN_NAME_SOURCE = "99a73b2f09cb86e17be0919ca1b2a7ae693eb456f13e5e4dd5dee76386ab4a4d";
export const UOO_WINTER_CHALLENGE_SOURCE = "eabd88330ac93105d53ff7f6bcb9640e6fe711b253a9ef10161e3fe155d87c9c";
const US_JUNIOR_SHORT_TRACK_SOURCE = "2531049f874a6f334b204d652398a897a18ad8c7316450af7985b086861bf12c";

export function sourceNameSql(name = "p.name", sourceHash = "s.sha256"): string {
  return `CASE WHEN ${sourceHash} IN ('${MASA_NAME_SOURCE}','${PRESIDENTIAL_NAME_SOURCE}') THEN REPLACE(${name},'*','')
    WHEN ${sourceHash} IN ('${WASHINGTON_NAME_SOURCE}','${ROBBY_KAUFMAN_NAME_SOURCE}') AND SUBSTR(${name},-1)='*' THEN SUBSTR(${name},1,LENGTH(${name})-1)
    WHEN ${sourceHash}='${ST_LOUIS_NAME_SOURCE}' AND ${name}='sawyer Nemeth' THEN 'Sawyer Nemeth'
    WHEN ${sourceHash}='${OHIO_NAME_SOURCE}' AND ${name}='HengYi Jin' THEN 'Hengyi Jin'
    WHEN ${sourceHash}='${US_JUNIOR_SHORT_TRACK_SOURCE}' AND ${name}='JaTier Salter' THEN 'Jatier Salter'
    WHEN ${sourceHash}='${UOO_WINTER_CHALLENGE_SOURCE}' THEN CASE ${name}
      WHEN 'ALVIN SUN' THEN 'Alvin Sun'
      WHEN 'YU ZHAO' THEN 'Yu Zhao'
      WHEN 'LeYan Xing' THEN 'Leyan Xing'
      WHEN 'Baily luck' THEN 'Baily Luck'
      WHEN 'Joanna chen' THEN 'Joanna Chen'
      WHEN 'Haozhe chen' THEN 'Haozhe Chen'
      ELSE ${name} END
    WHEN ${sourceHash}='${JANUARY_THAW_NAME_SOURCE}' THEN CASE ${name}
      WHEN 'Sage krishna' THEN 'Sage Krishna'
      WHEN 'JinSung Kim' THEN 'Jinsung Kim'
      ELSE REPLACE(${name},'*','') END
    ELSE ${name} END`;
}
