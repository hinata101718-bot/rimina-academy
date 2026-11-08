// 先輩と後輩の支援会話（11夜目、14夜目に増やして長く・分岐つきに）。a＝先輩（上の学年）、b＝後輩。{you}＝相手の名前
// 書き方は docs/writing-style.md（一人称は性格ごとに書き分けるか、省く。後輩は「{you}先輩」と呼ぶ）
import type { PhraseTable, TalkDef, TalkSay, TalkCond } from '../../core/types';

const PIDS = ['hot', 'calm', 'timid', 'cynic', 'gentle', 'serious', 'cheerful', 'shy', 'competitive', 'whimsical'] as const;
/** どの性格でも同じ文面（性格ごとの書き分けがある行は上書き） */
const D = (t: string) => ({ default: t, ...Object.fromEntries(PIDS.map((k) => [k, t])) });
const V = (base: string, over: Record<string, string>) => ({ ...D(base), ...over });
const iff = (c: TalkCond, then: TalkSay, els: TalkSay): TalkSay => ({ if: c, then, else: els });

export const PHRASES_SENPAI: PhraseTable = {
  // ---- 場面 ----
  sp_n_yard: D('夕方の訓練場。片づけをしている後輩に、先輩が声をかけた。'),
  sp_n_library: D('書庫の窓ぎわ。先輩が、後輩の広げたノートをのぞきこんでいる。'),
  sp_n_stable: D('厩舎の前で、先輩と後輩が並んで馬に水をやっている。'),
  sp_n_roof: D('卒業の近いある夜。寮の屋根の上で、先輩と後輩が星を見ていた。'),
  sp_n_hall: D('食堂のすみ。夕食のあと、先輩が後輩の向かいに腰をおろした。'),
  sp_n_bell: D('鐘楼の下。出撃の前の晩、先輩が後輩を呼びとめた。'),
  sp_n_gate: D('卒業式の前の日。傾いた校門の前で、先輩が後輩を待っていた。'),
  sp_x_n1: D('風が吹いて、二人のあいだを枯れ葉が転がっていった。'),
  sp_x_n2: D('遠くで、夕食を知らせる鐘が鳴った。'),
  sp_x_n3: D('しばらく、二人とも黙って同じ方を見ていた。'),

  // ---- C1：先輩のアドバイス（訓練場） ----
  sp_advice1: V('{you}、さっきの打ち込み、肩に力が入りすぎてたぞ。', { hot: 'おい{you}、さっきの打ち込み、肩がガチガチだったぞ！', calm: '{you}。さっきの打ち込み、肩に力が入っていた。', gentle: '{you}、さっきの打ち込み、肩がちょっと固かったねえ。', serious: '{you}さん、先ほどの打ち込みは肩に力が入りすぎていました。', shy: '……{you}。さっきの打ち込み、肩、固かった。', cheerful: '{you}、さっきの打ち込み、肩がカチコチだったよ！' }),
  sp_advice_r1: V('えっ、見てたんですか。', { timid: 'み、見てたんですか……。', cynic: '……見てたんですか。人が悪いな。', cheerful: '見てたんですか！ うわあ、恥ずかしい！', competitive: '見てたんですか。……自分でも、分かってはいたんです。', shy: '……見てたんですか。' }),
  sp_advice2: D('最初はみんなそうだ。息を吐きながら振ってみな。力は、当たる直前に入れればいい。'),
  sp_advice_r2: D('息を吐きながら……当たる直前に。'),
  sp_advice_try_ok: D('後輩が木剣を振りおろす。さっきより、ずっと乾いた音がした。'),
  sp_advice_try_hard: D('後輩が木剣を振りおろす。まだ少し固いが、音は変わってきた。'),
  sp_advice3_loud: V('ほら、もう音が違う！ 筋がいいぞ、{you}！', { cynic: 'ふうん、もう音が違う。……筋は悪くないね', competitive: '音が変わったな。……一年で、そこまで来られたら上出来だ' }),
  sp_advice3_quiet: V('音が変わった。その感じを、体に覚えさせておいて。', { serious: '音が変わりました。その感覚を、毎朝の素振りで確かめてください', calm: '音が変わった。今の感じを忘れるな' }),
  sp_advice_r3: V('ありがとうございます、先輩。……どうして、ここまで教えてくれるんですか？', { timid: 'あ、ありがとうございます……。でも、どうして、ここまで？', cynic: '……どうも。でも、なんでそこまで面倒見てくれるんです？', hot: 'ありがとうございます！ でも、なんでここまで教えてくれるんですか！' }),
  sp_advice4: D('一年のとき、同じことを先輩に言われたんだ。だから次は、{you}が誰かに言ってやれ。それで貸し借りなしだ。'),
  sp_advice_r4: D('……はい。ちゃんと見ていられる先輩になります。'),
  sp_x_go: D('さあ、もう少しだけやっていくか。日が暮れる前に。'),
  sp_x_yes: V('はい！', { shy: '……うん。はい。', cynic: '……付き合いますよ', calm: 'はい。お願いします', timid: 'は、はい！' }),

  // ---- C2：ノートの取り方（書庫） ----
  sp_note1: D('{you}のノート、字がびっしりだな。先生の言ったことを全部書いてるのか。'),
  sp_note_r1: V('はい。聞きもらしたら、こわくて。', { hot: 'はい！ 一言も聞きもらしたくなくて！', competitive: 'はい。誰よりも多く覚えておきたいので', cynic: '……全部書いとけば、あとで文句言われないんで', whimsical: 'なんとなく、全部書いちゃうんです。気分で' }),
  sp_note2: D('全部書くと、あとで読み返すのが大変だろう。いちばん大事な一行に、線を一本引いておくといい。'),
  sp_note_r2: D('一本だけ、ですか？'),
  sp_note3: D('そう。二本引いたら、どっちも大事じゃなくなる。先生の話で声が大きくなったところが、だいたいその一行だ。'),
  sp_note_r3_quiet: V('……それなら、わたしにもできそうです。', { calm: 'なるほど。声の大きさ、か。明日から試します', serious: '承知しました。明日の講義から、そのように整理します' }),
  sp_note_r3_loud: V('声が大きいところ！ それなら分かりやすいです！', { cynic: '声が大きいところ、ね。……あの先生、全部大きい気がするけど', competitive: '声の大きいところか。……先輩より上手にまとめてみせます' }),
  sp_note4: D('それと、ノートのすみに、その日いちばん困ったことを書いておけ。半年たって読み返すと、笑えるから。'),
  sp_note_r4: D('笑えるんですか。'),
  sp_note5: D('ああ。あんなことで悩んでたのか、って。それが分かると、自分が伸びたのが分かる。'),
  sp_note_r5: D('……今日いちばん困ったこと、書いておきます。先輩に話しかけられて、緊張したこと。'),
  sp_note6: D('それは困ったことに入るのか。……まあいい。半年後に、笑って見せてくれ。'),

  // ---- B1：後輩の悩み（食堂） ----
  sp_worry1: D('先輩。……正直に言うと、ときどき、ここにいていいのか分からなくなるんです。'),
  sp_worry2_low: D('このところ、授業でも空回りばかりで。昨日も、先生にため息をつかれた気がして。'),
  sp_worry2_ok: D('みんな、どんどん先に行っちゃって。自分だけ置いていかれている気がして。'),
  sp_worry_r1: V('分かるよ。去年、同じことを思ってた。', { cynic: '……分かるよ。柄じゃないけど、去年は同じことを考えてた', hot: '分かる！ 去年、まったく同じことで悩んでたんだ！', serious: '分かります。私も去年、同じことを考えていました', shy: '……分かる。去年、同じだった' }),
  sp_worry_r2: D('でもな、{you}のこのノート。授業の要点が、こっちのより分かりやすい。それは{you}にしかできないことだ。'),
  sp_worry3: D('……そんなこと、初めて言われました。'),
  sp_worry4: D('置いていかれる気がするのは、前を見てる証拠だ。後ろを見てたら、そんな気はしない。'),
  sp_worry_r3: V('前を見てる証拠……。', { cheerful: '前を見てる証拠！ なんか、かっこいいですね', timid: '前を……。そっか、そう考えれば、いいのかな' }),
  sp_worry5_war: D('それに、戦が近い。焦る気持ちは分かる。でも焦った子から、戦場で転ぶんだ。'),
  sp_worry5_peace: D('今は戦がない。急がなくていい時に、ゆっくり伸びておけ。それは贅沢なことだぞ。'),
  sp_worry_r4: D('……分かりました。ゆっくり、でも、止まらずに。'),
  sp_worry6: D('そう。それと、困ったらまた食堂のこの席に来い。だいたい、ここで豆のスープを食べてるから。'),
  sp_worry_r5: V('豆のスープ、好きなんですね。', { cheerful: '豆のスープ、毎日なんですか！？ 今度、わたしも頼んでみます！', cynic: '毎日豆なのか……。まあ、覚えておきます', gentle: 'ふふ、豆のスープ。今度、いっしょに食べましょうねえ' }),
  sp_x_thanks: V('……ありがとうございます、先輩。', { hot: 'ありがとうございます、先輩！', cynic: '……どうも。助かりましたよ、先輩', shy: '……ありがとう、ございます。先輩' }),

  // ---- B2：先輩の失敗談（厩舎） ----
  sp_fail1: D('実はな、初陣は散々だったんだ。馬から落ちて、敵の前で尻もちをついた。'),
  sp_fail_r1: V('えっ、先輩が？ 信じられません。', { cheerful: 'えーっ、先輩が！？ 見たかった……あ、ごめんなさい！', cynic: '……先輩でも、そういうことがあるんですね', shy: 'せ、先輩が……ですか', competitive: '先輩が？ ……少し、安心しました' }),
  sp_fail2: D('笑っていいぞ。槍も手から飛んでいって、どこに落ちたかも分からなかった。'),
  sp_fail_r2: D('それで、どうなったんですか。'),
  sp_fail3: D('当時の先輩が、自分の盾を投げてよこしてくれた。「立て、ここはまだ戦場だ」って。'),
  sp_fail_r3_hurt: D('……この前のけがのとき、立てなかったんです。怖くて。'),
  sp_fail_r3_ok: D('その先輩、かっこいいですね。'),
  sp_fail4_hurt: D('立てなくていい。立てなかったことを覚えておけば、次は誰かに盾を投げられる。'),
  sp_fail4_ok: D('ああ。今は王国の砦にいるらしい。手紙は、三回に一回しか返ってこないけどな。'),
  sp_fail_r4: D('……次の戦いで、もし先輩が転んだら、わたしが盾を投げます。'),
  sp_fail5: V('はは、それは頼もしいな。……転ばないように気をつけるよ。', { calm: '……そうか。それなら、安心して前に出られる', serious: 'それは心強い。ですが、転ばないよう努めます', whimsical: 'ふふ、じゃあ、たまにはわざと転んでみようかな。冗談' }),
  sp_fail_r5: V('約束ですよ。', { hot: '約束ですからね！', shy: '……約束、です', cynic: '……一応、約束ですからね' }),
  sp_fail6: D('ああ。馬に水をやり終えたら、今の話は二人だけの秘密だ。'),

  // ---- B3：戦場の話（鐘楼の下） ----
  sp_war1: D('明日の出撃、{you}は初めての前列だな。'),
  sp_war_r1: V('はい。……眠れそうにありません。', { hot: 'はい！ 体が熱くて、眠れそうにないです！', calm: 'はい。……正直に言えば、少し落ち着きません', competitive: 'はい。足を引っぱるつもりはありません', whimsical: 'はい。たぶん、眠れないかも' }),
  sp_war2: D('眠れなくていい。目を閉じて、横になってるだけで体は休まる。それより、ひとつだけ覚えておけ。'),
  sp_war_r2: D('……なんですか。'),
  sp_war3: D('隣を見ろ。前の敵より、隣の仲間を見ろ。隣が倒れそうなら、そっちが先だ。'),
  sp_war_r3: D('敵より、隣……。'),
  sp_war4_war: D('今は戦が続いてる。敵も必死だ。自分を守る一番の方法は、隣を守ることなんだ。'),
  sp_war4_peace: D('相手は盗賊でも、刃は本物だ。隣と息を合わせていれば、たいていのことは何とかなる。'),
  sp_war_r4_loud: V('分かりました！ 隣は、先輩ですよね。任せてください！', { cynic: '……隣が先輩なら、まあ、見ててあげますよ', competitive: '隣が先輩なら、先輩より先に敵を倒します' }),
  sp_war_r4_quiet: V('……隣は、先輩ですよね。ちゃんと、見ています。', { serious: '隣は先輩ですね。決して目を離しません', calm: '隣は先輩か。分かった、見ている' }),
  sp_war5: D('ああ。こっちも{you}を見てる。だから、明日はちゃんと帰ってこよう。二人で。'),
  sp_war_r5: D('……はい。二人で。'),

  // ---- A1：卒業したら（屋根の上） ----
  sp_future1: D('もうすぐ卒業か。……{you}と、こうして話すのも最後かもしれないな。'),
  sp_future_r1: V('そんなこと言わないでください。手紙、書きますから。', { cynic: '……やめてくださいよ、そういうの。手紙くらい書きますから', hot: 'そんなこと言わないでください！ 手紙、毎月書きます！', shy: '……最後なんて、いやです。手紙、書きます' }),
  sp_future2: D('手紙か。返事が遅くなっても、怒るなよ。'),
  sp_future_r2: D('先輩の先輩みたいに、三回に一回ですか？'),
  sp_future3: D('はは、覚えてたのか。……二回に一回は返すよ。たぶん。'),
  sp_future_r3: D('卒業したら、どこへ行くんですか。'),
  sp_future4_same: D('まだ決めてない。でも、{you}の国の兵になるのも悪くないと思ってる。同じ旗の下なら、また会えるだろう。'),
  sp_future4_diff: D('まだ決めてない。……もし国が違ったら、戦場で向かい合うこともあるのかもしれないな。'),
  sp_future_r4_same: D('同じ旗の下……。それなら、早く追いつかないと。'),
  sp_future_r4_diff: D('……そんなの、いやです。'),
  sp_future5: D('こっちもいやだ。だから、もし会ったら、そのときは互いの名前を呼ぼう。それで、剣は下ろせる。'),
  sp_future_r5: D('名前を、呼ぶ。'),
  sp_future6: D('ああ。それと、このノートを持っていけ。三年分の失敗と工夫が書いてある。{you}なら、うまく使える。'),
  sp_future_r6: V('……大事にします。いつか、今度は誰かに渡します。', { hot: '大事にします！ いつか、絶対に誰かに渡します！', cynic: '……捨てませんよ。いつか、誰かに押しつけます', competitive: '受け取ります。いつか、これより分厚いノートを誰かに渡します' }),
  sp_future7: D('星が流れたな。……願いごと、したか？'),
  sp_future_r7_loud: V('しました！ 先輩が、無事でいますようにって！', { cynic: '……しましたよ。内容は秘密です', competitive: 'しました。先輩に追いつけますように、です' }),
  sp_future_r7_quiet: V('……しました。先輩が、無事でいられますように。', { calm: 'しました。先輩の無事を', serious: 'はい。先輩のご武運を、お祈りしました' }),
  sp_future8: D('そうか。……こっちも、同じことを願った。'),

  // ---- A2：託す約束（校門の前） ----
  sp_gate1: D('明日で、この門をくぐるのも最後だ。入学した日は、傾いてて、くぐるのが怖かったな。'),
  sp_gate_r1: V('今も傾いてますよ。', { cheerful: '今もけっこう傾いてますよ！', cynic: '今も傾いてますけどね', gentle: '今も、ちょっとだけ傾いてますねえ', serious: '今も傾いております。来年は直していただきたいものです' }),
  sp_gate2: D('はは、そうだな。でも、もう怖くない。この学校で、怖くなくなる方法を覚えたから。'),
  sp_gate_r2: D('怖くなくなる方法、ですか。'),
  sp_gate3: D('誰かの背中を見ることだ。最初は先生の背中、それから先輩の背中。そのうち、自分が誰かの背中になる。'),
  sp_gate_r3: D('……先輩の背中、ずっと見てました。'),
  sp_gate4: D('知ってる。訓練場でも、戦場でも、ずっと視線を感じてた。……正直、ちょっと照れくさかった。'),
  sp_gate_r4_loud: V('照れくさかったんですか！ ずるいです、言ってくださいよ！', { cynic: '……照れくさかったなら、言ってくださいよ。こっちだって照れくさい', competitive: '照れてたんですか。……勝った気がします' }),
  sp_gate_r4_quiet: V('……気づいてたんですね。', { calm: '気づいていたのか。……それは、少し恥ずかしいな', serious: '気づかれていたとは。失礼いたしました' }),
  sp_gate5: D('次は、{you}の番だ。来年入ってくる一年生は、きっと{you}の背中を見る。'),
  sp_gate_r5: D('自信、ないです。'),
  sp_gate6_war: D('自信はなくていい。ただ、戦場で背中を向けて逃げるな。それだけで、後ろの子は走れる。'),
  sp_gate6_peace: D('自信はなくていい。毎朝、訓練場にいればいい。それだけで、後ろの子は安心する。'),
  sp_gate_r6: D('……分かりました。毎朝、いるようにします。'),
  sp_gate7: D('よし。じゃあ最後に、ひとつ頼みがある。'),
  sp_gate_r7: D('なんですか？'),
  sp_gate8: D('この門を、いつか直してくれ。{you}が先輩になったとき、後輩が怖がらずにくぐれるように。'),
  sp_gate_r8: V('……はい。必ず。', { whimsical: '……はい。たぶん、じゃなくて、必ず', cynic: '……はいはい。必ず、直しますよ', hot: 'はい！ 必ず直します！' }),
  sp_gate9: D('いい返事だ。……じゃあな、{you}。卒業式で泣くなよ。'),
};

const L = { kind: 'senpai' as const, a: { senior: true } };
const loudB = { b: { group: 'loud' as const } };
const loudA = { a: { group: 'loud' as const } };
export const TALKS_SENPAI: TalkDef[] = [
  { id: 'rel_senpai_c1', topic: 'rel_senpai', rank: 'C', when: L, lines: [
    { by: 'n', say: 'sp_n_yard' }, { by: 'a', say: 'sp_advice1' }, { by: 'b', say: 'sp_advice_r1' }, { by: 'a', say: 'sp_advice2' }, { by: 'b', say: 'sp_advice_r2' },
    { by: 'n', say: iff({ b: { highMood: true } }, 'sp_advice_try_ok', 'sp_advice_try_hard') },
    { by: 'a', say: iff(loudA, 'sp_advice3_loud', 'sp_advice3_quiet') }, { by: 'b', say: 'sp_advice_r3' }, { by: 'a', say: 'sp_advice4' },
    { by: 'b', say: iff({ b: { lowMood: true } }, 'sp_x_thanks', 'sp_advice_r4') }, { by: 'a', say: 'sp_x_go' }, { by: 'b', say: 'sp_x_yes' },
  ] },
  { id: 'rel_senpai_c2', topic: 'rel_senpai', rank: 'C', when: L, lines: [
    { by: 'n', say: 'sp_n_library' }, { by: 'a', say: 'sp_note1' }, { by: 'b', say: 'sp_note_r1' }, { by: 'a', say: 'sp_note2' }, { by: 'b', say: 'sp_note_r2' }, { by: 'a', say: 'sp_note3' },
    { by: 'b', say: iff(loudB, 'sp_note_r3_loud', 'sp_note_r3_quiet') }, { by: 'a', say: 'sp_note4' },
    { by: 'b', say: iff({ b: { lowMood: true } }, 'sp_note_r4', 'sp_note_r5') },
    { by: 'a', say: 'sp_note6' }, { by: 'n', say: 'sp_x_n2' },
  ] },
  { id: 'rel_senpai_b1', topic: 'rel_senpai', rank: 'B', when: L, lines: [
    { by: 'n', say: 'sp_n_hall' }, { by: 'b', say: 'sp_worry1' }, { by: 'b', say: iff({ b: { lowMood: true } }, 'sp_worry2_low', 'sp_worry2_ok') },
    { by: 'a', say: 'sp_worry_r1' }, { by: 'a', say: 'sp_worry_r2' }, { by: 'b', say: 'sp_worry3' }, { by: 'a', say: 'sp_worry4' }, { by: 'b', say: 'sp_worry_r3' },
    { by: 'a', say: iff({ stage: 'peace' }, 'sp_worry5_peace', 'sp_worry5_war') }, { by: 'b', say: 'sp_worry_r4' }, { by: 'a', say: 'sp_worry6' }, { by: 'b', say: 'sp_worry_r5' },
    { by: 'n', say: 'sp_x_n1' }, { by: 'b', say: 'sp_x_thanks' },
  ] },
  { id: 'rel_senpai_b2', topic: 'rel_senpai', rank: 'B', when: L, lines: [
    { by: 'n', say: 'sp_n_stable' }, { by: 'a', say: 'sp_fail1' }, { by: 'b', say: 'sp_fail_r1' }, { by: 'a', say: 'sp_fail2' }, { by: 'b', say: 'sp_fail_r2' }, { by: 'a', say: 'sp_fail3' },
    { by: 'b', say: iff({ b: { recent: 'ev_injury' } }, 'sp_fail_r3_hurt', 'sp_fail_r3_ok') },
    { by: 'a', say: iff({ b: { recent: 'ev_injury' } }, 'sp_fail4_hurt', 'sp_fail4_ok') },
    { by: 'b', say: 'sp_fail_r4' }, { by: 'a', say: 'sp_fail5' }, { by: 'b', say: 'sp_fail_r5' }, { by: 'a', say: 'sp_fail6' }, { by: 'n', say: 'sp_x_n2' },
  ] },
  { id: 'rel_senpai_b3', topic: 'rel_senpai', rank: 'B', when: L, lines: [
    { by: 'n', say: 'sp_n_bell' }, { by: 'a', say: 'sp_war1' }, { by: 'b', say: 'sp_war_r1' }, { by: 'a', say: 'sp_war2' }, { by: 'b', say: 'sp_war_r2' }, { by: 'a', say: 'sp_war3' }, { by: 'b', say: 'sp_war_r3' },
    { by: 'a', say: iff({ stage: 'peace' }, 'sp_war4_peace', 'sp_war4_war') },
    { by: 'b', say: iff(loudB, 'sp_war_r4_loud', 'sp_war_r4_quiet') }, { by: 'a', say: 'sp_war5' }, { by: 'b', say: 'sp_war_r5' }, { by: 'n', say: 'sp_x_n3' },
  ] },
  { id: 'rel_senpai_a1', topic: 'rel_senpai', rank: 'A', when: L, lines: [
    { by: 'n', say: 'sp_n_roof' }, { by: 'a', say: 'sp_future1' }, { by: 'b', say: 'sp_future_r1' }, { by: 'a', say: 'sp_future2' }, { by: 'b', say: 'sp_future_r2' }, { by: 'a', say: 'sp_future3' }, { by: 'b', say: 'sp_future_r3' },
    { by: 'a', say: iff({ sameCountry: true }, 'sp_future4_same', 'sp_future4_diff') },
    { by: 'b', say: iff({ sameCountry: true }, 'sp_future_r4_same', 'sp_future_r4_diff') },
    { by: 'a', say: 'sp_future5' }, { by: 'b', say: 'sp_future_r5' }, { by: 'a', say: 'sp_future6' }, { by: 'b', say: 'sp_future_r6' }, { by: 'n', say: 'sp_x_n3' },
    { by: 'a', say: 'sp_future7' }, { by: 'b', say: iff(loudB, 'sp_future_r7_loud', 'sp_future_r7_quiet') }, { by: 'a', say: 'sp_future8' },
  ] },
  { id: 'rel_senpai_a2', topic: 'rel_senpai', rank: 'A', when: L, lines: [
    { by: 'n', say: 'sp_n_gate' }, { by: 'a', say: 'sp_gate1' }, { by: 'b', say: 'sp_gate_r1' }, { by: 'a', say: 'sp_gate2' }, { by: 'b', say: 'sp_gate_r2' }, { by: 'a', say: 'sp_gate3' }, { by: 'b', say: 'sp_gate_r3' }, { by: 'a', say: 'sp_gate4' },
    { by: 'b', say: iff(loudB, 'sp_gate_r4_loud', 'sp_gate_r4_quiet') }, { by: 'a', say: 'sp_gate5' }, { by: 'b', say: 'sp_gate_r5' },
    { by: 'a', say: iff({ stage: 'peace' }, 'sp_gate6_peace', 'sp_gate6_war') }, { by: 'b', say: 'sp_gate_r6' }, { by: 'a', say: 'sp_gate7' }, { by: 'b', say: 'sp_gate_r7' }, { by: 'a', say: 'sp_gate8' }, { by: 'b', say: 'sp_gate_r8' }, { by: 'a', say: 'sp_gate9' },
  ] },
];
