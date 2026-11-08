// 先輩と後輩の支援会話（11夜目）。a＝先輩（上の学年）、b＝後輩。{you}＝相手の名前。書き方は docs/writing-style.md
import type { PhraseTable, TalkDef } from '../../core/types';

const PIDS = ['hot', 'calm', 'timid', 'cynic', 'gentle', 'serious', 'cheerful', 'shy', 'competitive', 'whimsical'] as const;
/** どの性格でも同じ文面（性格ごとの書き分けがある行は上書き） */
const D = (t: string) => ({ default: t, ...Object.fromEntries(PIDS.map((k) => [k, t])) });
const V = (base: string, over: Record<string, string>) => ({ ...D(base), ...over });
export const PHRASES_SENPAI: PhraseTable = {
  sp_n_yard: D('夕方の訓練場。片づけをしている後輩に、先輩が声をかけた。'),
  sp_n_library: D('書庫の窓ぎわ。先輩が、後輩の広げたノートをのぞきこんでいる。'),
  sp_n_stable: D('厩舎の前で、先輩と後輩が並んで馬に水をやっている。'),
  sp_n_roof: D('卒業の近いある夜。寮の屋根の上で、先輩と後輩が星を見ていた。'),
  sp_advice1: V('{you}、さっきの打ち込み、肩に力が入りすぎてたぞ。', { hot: 'おい{you}、さっきの打ち込み、肩がガチガチだったぞ！', calm: '{you}、さっきの打ち込みですが、肩に力が入っていました。', gentle: '{you}、さっきの打ち込み、肩がちょっと固かったかも。', serious: '{you}、先ほどの打ち込みは肩に力が入りすぎていた。' }),
  sp_advice2: D('最初はみんなそうだ。息を吐きながら振ってみな。力は最後に入れればいい。'),
  sp_advice_r1: V('えっ、見てたんですか。……息を吐きながら、ですね。', { timid: 'み、見てたんですか……。息を、吐きながら……やってみます。', cynic: '見てたのかよ。……まあ、試してみる。', cheerful: '見てたんですか！ 息を吐きながら、ですね。やってみます！' }),
  sp_advice3: D('おれも一年のとき、同じことを先輩に言われたんだ。だから、次は{you}が誰かに言ってやれ。'),
  sp_advice_r2: D('はい。先輩みたいに、ちゃんと見ていられる人になります。'),
  sp_worry1: D('先輩。……正直に言うと、ときどき、ここにいていいのか分からなくなるんです。'),
  sp_worry2: D('みんな、どんどん先に行っちゃって。わたしだけ置いていかれている気がして。'),
  sp_worry_r1: D('分かるよ。おれも去年、同じことを思ってた。'),
  sp_worry_r2: D('でもな、{you}の書いたこのノート。授業の要点が、おれのより分かりやすい。それは{you}にしかできないことだ。'),
  sp_worry3: D('……そんなふうに見てくれてたんですね。少し、楽になりました。'),
  sp_fail1: D('実はな、おれの初陣は散々だったんだ。馬から落ちて、敵の前で尻もちをついた。'),
  sp_fail_r1: V('えっ、先輩が？ 信じられません。', { cheerful: 'えーっ、先輩が！？ 見たかった……あ、ごめんなさい！', cynic: '……先輩でも、そういうことがあるんだな。', shy: 'せ、先輩が……ですか。' }),
  sp_fail2: D('笑っていいぞ。あのとき助けてくれたのが、当時の先輩だった。だから今度は、おれが{you}の背中を見ている。'),
  sp_fail_r2: D('……ずるいです、そういう話。次の戦い、先輩の背中を見て走ります。'),
  sp_future1: D('もうすぐ卒業か。……{you}と、こうして話すのも最後かもしれないな。'),
  sp_future_r1: D('そんなこと言わないでください。手紙、書きますから。'),
  sp_future2: D('このノート、持っていけ。三年分の、失敗と工夫が書いてある。{you}なら、うまく使えるはずだ。'),
  sp_future_r2: D('……大事にします。いつか、わたしも誰かに渡します。'),
  sp_future3: D('戦場で会ったら、そのときは味方でいような。'),
  sp_x_n1: D('風が吹いて、二人のあいだを枯れ葉が転がっていった。'),
  sp_x_thanks: D('……ありがとうございます、先輩。'),
  sp_x_go: D('さあ、もう少しだけやっていくか。日が暮れる前に。'),
  sp_x_yes: D('はい！'),
};

export const TALKS_SENPAI: TalkDef[] = [
  { id: 'rel_senpai_c1', topic: 'rel_senpai', rank: 'C', when: { kind: 'senpai', a: { senior: true } }, lines: [
    { by: 'n', say: 'sp_n_yard' }, { by: 'a', say: 'sp_advice1' }, { by: 'a', say: 'sp_advice2' }, { by: 'b', say: 'sp_advice_r1' }, { by: 'a', say: 'sp_advice3' }, { by: 'b', say: 'sp_advice_r2' }, { by: 'n', say: 'sp_x_n1' }, { by: 'a', say: 'sp_x_go' }, { by: 'b', say: 'sp_x_yes' },
  ] },
  { id: 'rel_senpai_b1', topic: 'rel_senpai', rank: 'B', when: { kind: 'senpai', a: { senior: true } }, lines: [
    { by: 'n', say: 'sp_n_library' }, { by: 'b', say: 'sp_worry1' }, { by: 'b', say: 'sp_worry2' }, { by: 'a', say: 'sp_worry_r1' }, { by: 'a', say: 'sp_worry_r2' }, { by: 'b', say: 'sp_worry3' }, { by: 'n', say: 'sp_x_n1' }, { by: 'b', say: 'sp_x_thanks' },
  ] },
  { id: 'rel_senpai_b2', topic: 'rel_senpai', rank: 'B', when: { kind: 'senpai', a: { senior: true } }, lines: [
    { by: 'n', say: 'sp_n_stable' }, { by: 'a', say: 'sp_fail1' }, { by: 'b', say: 'sp_fail_r1' }, { by: 'a', say: 'sp_fail2' }, { by: 'b', say: 'sp_fail_r2' }, { by: 'n', say: 'sp_x_n1' }, { by: 'a', say: 'sp_x_go' }, { by: 'b', say: 'sp_x_yes' },
  ] },
  { id: 'rel_senpai_a1', topic: 'rel_senpai', rank: 'A', when: { kind: 'senpai', a: { senior: true } }, lines: [
    { by: 'n', say: 'sp_n_roof' }, { by: 'a', say: 'sp_future1' }, { by: 'b', say: 'sp_future_r1' }, { by: 'a', say: 'sp_future2' }, { by: 'b', say: 'sp_future_r2' }, { by: 'a', say: 'sp_future3' }, { by: 'n', say: 'sp_x_n1' }, { by: 'b', say: 'sp_x_thanks' },
  ] },
];
