// 23夜目⑦：進軍の文と戦場の並び（名前と戦場の形）。最後の戦場は、依頼の目的の場所（宿敵ごとの戦場など）
export type RestKind = 'heal' | 'swap' | 'equip' | 'scout';

/** 依頼の種類ごとの、戦場の名前と形（5つ。戦場の数に合わせて選ぶ。最後はいつも5つ目） */
export const MARCH_STAGES: Record<'army' | 'bandit' | 'monster' | 'defend' | 'rescue', { names: string[]; fields: string[] }> = {
  army: { names: ['前哨', '砦の前', '城門', '中庭', '本陣'], fields: ['plain', 'plain', 'fort', 'ruins', 'fort'] },
  bandit: { names: ['森の入り口', '見張り小屋', '谷あい', '隠れ家の前', '頭目の根城'], fields: ['woods', 'village', 'pass', 'woods', 'woods'] },
  monster: { names: ['獣道', '沢', '洞の前', '深い森', '群れの巣'], fields: ['woods', 'plain', 'pass', 'woods', 'woods'] },
  defend: { names: ['街道', '橋のたもと', '村の外れ', '柵の前', '村の広場'], fields: ['plain', 'pass', 'village', 'village', 'village'] },
  rescue: { names: ['外れの見張り', '抜け道', '牢の前', '城壁', '門の外'], fields: ['woods', 'pass', 'ruins', 'fort', 'ruins'] },
};

export const REST_TEXT: Record<RestKind, { name: string; desc: string }> = {
  heal: { name: '手当て', desc: 'みなの体力を、もう少し戻す（最大の4分の1）' },
  swap: { name: '入れ替え', desc: '後ろで支える子と、1人入れ替える' },
  equip: { name: '武器と技の付け替え', desc: '持っていく武器と技を見直す' },
  scout: { name: '偵察', desc: '次の戦場の敵将の弱点を、1つ明かす' },
};

export const ROUTE_TEXT = {
  short: { name: '近道', desc: 'すぐ着くが、敵が多い（雑兵+2）' },
  detour: { name: '回り道', desc: '宝箱がある。遅れたぶん、敵は守りを固める（盾+1）' },
};

export const MARCH_TEXT = {
  /** 前の戦場から退いた敵将・宿敵の、次の戦場の口上 */
  regroup: [
    'さっきの借りは返す。ここから先へは通さん',
    '一度退いたのは、ここで迎え撃つためだ',
    '傷は浅い。……次は、こちらの番だ',
    '逃げたと思ったか。ここが本当の戦場だ',
    'よく追ってきたな。その執念ごと、ここで断つ',
  ],
  /** 最後の戦場でない敵将が、倒れずに次へ退くとき */
  retreatNext: '{n}は兵をまとめ、次の戦場へ退いた（傷を負ったまま、待ち構える）',
};
