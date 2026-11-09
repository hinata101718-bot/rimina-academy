// 20夜目：最上級の兵種になる条件の出来事（docs/new/classes.md）。
// 学校の戦いで成し遂げたもの（core/tactics/after.ts）と、卒業後の戦いで成し遂げたもの（core/alumni.ts）を、Student.deeds に数える。
export type DeedKind = 'war' | 'nemesis' | 'count' | 'school' | 'spy';
export interface DeedDef {
  id: string;
  /** 卒業後の戦い（大きな戦・宿敵との戦い）で成し遂げる見込みの種類 */
  kind: DeedKind;
  /** 卒業後、1年に成し遂げる見込み（戦時。平時はこの3分の1） */
  odds: number;
  /** 卒業後に成し遂げたときの文（「{a}」＝国の名） */
  alumni: string[];
}
export const DEEDS: Record<string, DeedDef> = {
  unhurt: { id: 'unhurt', kind: 'count', odds: 0.7, alumni: ['この年の戦も、傷ひとつ負わずに戦い抜いた'] },
  overcome: { id: 'overcome', kind: 'nemesis', odds: 0.06, alumni: ['弱点を克服した敵の名将を、一騎打ちで退けた'] },
  turnTide: { id: 'turnTide', kind: 'war', odds: 0.1, alumni: ['{a}の負け戦を、ただひとりの突撃でひっくり返した', '総崩れの{a}軍の先頭に立ち、戦の流れを変えた'] },
  skyChase: { id: 'skyChase', kind: 'nemesis', odds: 0.06, alumni: ['逃げる敵の名将を空から追いつめた'] },
  ledArmy: { id: 'ledArmy', kind: 'war', odds: 0.1, alumni: ['{a}の軍を率いて、大きな戦に勝った'] },
  holdGeneral: { id: 'holdGeneral', kind: 'war', odds: 0.08, alumni: ['{a}の砦を守り抜き、攻めてきた将を退けた'] },
  guardLethal: { id: 'guardLethal', kind: 'nemesis', odds: 0.06, alumni: ['仲間をかばい、命を奪うはずの一撃を受けきった'] },
  surrounded: { id: 'surrounded', kind: 'war', odds: 0.08, alumni: ['敵の中に取り残され、囲まれながらも生きて戻った'] },
  lastBreath: { id: 'lastBreath', kind: 'nemesis', odds: 0.05, alumni: ['深手を負い、立っているのがやっとの体で敵の将を討った'] },
  axeBoss: { id: 'axeBoss', kind: 'nemesis', odds: 0.06, alumni: ['敵の大将を、斧の一撃で討ち取った'] },
  snipeNemesis: { id: 'snipeNemesis', kind: 'nemesis', odds: 0.06, alumni: ['遠く離れた丘から、敵の名将を射止めた'] },
  chaseKill: { id: 'chaseKill', kind: 'nemesis', odds: 0.05, alumni: ['かつて逃げのびた敵の名将を追い、ついに討った'] },
  burnFort: { id: 'burnFort', kind: 'war', odds: 0.07, alumni: ['{a}の敵の砦に火矢を放ち、焼き落とした'] },
  mentor: { id: 'mentor', kind: 'school', odds: 0, alumni: ['学校に戻り、後輩を導いている'] },
  curseMaster: { id: 'curseMaster', kind: 'count', odds: 0.6, alumni: ['呪いの力を、さらに使いこなすようになった'] },
  lastWords: { id: 'lastWords', kind: 'nemesis', odds: 0.05, alumni: ['討ち取った敵の名将の、最期の言葉を聞いた'] },
  sealRevived: { id: 'sealRevived', kind: 'nemesis', odds: 0.04, alumni: ['呪いで蘇った者を、光の封印で眠らせた'] },
  saveLife: { id: 'saveLife', kind: 'count', odds: 0.4, alumni: ['戦場で、死にかけた仲間の命をつないだ'] },
  darkNemesis: { id: 'darkNemesis', kind: 'nemesis', odds: 0.05, alumni: ['闇の力をまとう敵の名将を、光で討った'] },
  topple: { id: 'topple', kind: 'spy', odds: 0.06, alumni: ['密偵として敵の陣にもぐりこみ、敵の将を失脚させた'] },
  seeTrap: { id: 'seeTrap', kind: 'nemesis', odds: 0.06, alumni: ['敵の名将の罠を見抜き、仲間の部隊を救った'] },
  outwit: { id: 'outwit', kind: 'nemesis', odds: 0.05, alumni: ['敵の名将を出し抜き、囲みから逃げきった'] },
  shieldTeacher: { id: 'shieldTeacher', kind: 'nemesis', odds: 0.03, alumni: ['仕える将を、敵の名将の一撃からかばいきった'] },
  breakLine: { id: 'breakLine', kind: 'war', odds: 0.1, alumni: ['{a}の大きな戦で、敵の陣を突き破った'] },
  skyKill: { id: 'skyKill', kind: 'nemesis', odds: 0.05, alumni: ['空から急降下し、敵の名将を討った'] },
  rearguard: { id: 'rearguard', kind: 'war', odds: 0.08, alumni: ['{a}軍が退くとき、殿を務めて逃げきった'] },
};
