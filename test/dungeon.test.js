const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// 从单文件 HTML 中提取 <script> 并加载其 module.exports（与扫雷同模式）
function loadGame() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'fun', 'dungeon', 'index.html'), 'utf8');
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('no <script> block found');
  const mod = new module.constructor();
  mod._compile(m[1], 'dungeon.js');
  return mod.exports;
}

const G = loadGame();
const { MAP_W, MAP_H, createGame, generateFloor, move, wait, autoAttack,
  pickUp, descend, worldTick, findPath, computeFov, addMonster, damageMonster,
  playerAttack, monsterAt } = G;

// ---------- 测试辅助 ----------
// 全地板空竞技场，便于精确控制局面
function flatMap(g) {
  g.map = new Array(MAP_W * MAP_H).fill(1);
  g.monsters = [];
  g.items = [];
  g.stairs = null;
}
// 确定性伪随机数（mulberry32），与游戏内一致
function seededRng(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// 固定 rng：抑制掉落（roll 0.99 什么都不掉）与游荡（不移动）
function calm(g) {
  g.rng = () => 0.99;
}
function makeGame(seed = 1) {
  const g = createGame({ seed });
  calm(g);
  flatMap(g);
  g.player.r = 10; g.player.c = 10;
  computeFov(g); // 自动锁定依赖 FOV
  return g;
}
// 沿楼梯下潜到第 n 层（生成地图需要真随机源，用完再 calm）
function gotoFloor(g, n, seed = 99) {
  while (g.floor < n) {
    assert.ok(g.stairs, `floor ${g.floor} should have stairs`);
    g.player.r = g.stairs.r; g.player.c = g.stairs.c;
    g.rng = seededRng(seed + g.floor);
    descend(g);
  }
  calm(g);
}

test('createGame 初始状态：第 1 层、进行中、1 档近战、有怪物', () => {
  const g = createGame({ seed: 7 });
  assert.equal(g.floor, 1);
  assert.equal(g.status, 'playing');
  assert.equal(g.player.hp, 40);
  assert.equal(g.player.maxHp, 40);
  assert.deepEqual(g.player.weapon, { class: 'melee', tier: 1, name: '短剑' });
  assert.equal(g.player.level, 1);
  assert.ok(g.monsters.length > 0);
  assert.ok(g.stairs, '第 1 层应有楼梯');
});

test('种子确定性：相同种子生成相同地牢，不同种子不同', () => {
  const a = createGame({ seed: 42 });
  const b = createGame({ seed: 42 });
  const c = createGame({ seed: 43 });
  const snap = g => JSON.stringify({ map: g.map, mons: g.monsters.map(m => [m.type, m.r, m.c]), stairs: g.stairs });
  assert.equal(snap(a), snap(b));
  assert.notEqual(snap(a), snap(c));
});

test('移动：平地移动成功并消耗回合', () => {
  const g = makeGame();
  move(g, 1, 0);
  assert.equal(g.player.r, 11);
  assert.equal(g.player.c, 10);
  assert.equal(g.turns, 1);
  move(g, 0, -1);
  assert.equal(g.player.c, 9);
  assert.equal(g.turns, 2);
});

test('碰撞：撞墙不动且不消耗回合', () => {
  const g = makeGame();
  g.map[11 * MAP_W + 10] = 0; // 脚下是墙
  move(g, 1, 0);
  assert.equal(g.player.r, 10);
  assert.equal(g.turns, 0);
});

test('撞怪被挡：不攻击、不位移、不耗回合、无 fx', () => {
  const g = makeGame();
  const m = addMonster(g, 'slime', 11, 10); // 玩家 (10,10) 正下方
  move(g, 1, 0); // 撞怪只被挡住
  assert.equal(g.player.r, 10);
  assert.equal(g.player.c, 10);
  assert.equal(m.hp, 12, '怪物不掉血');
  assert.equal(g.player.hp, 40, '玩家不掉血');
  assert.equal(g.turns, 0, '不耗回合');
  assert.ok(!g.fx.some(e => e.kind === 'melee'), '不攻击则无近战动画');
  assert.ok(g.log.some(l => l.includes('挡住了去路')));
  assert.deepEqual(g.player.dir, { dr: 1, dc: 0 }, '朝向仍按按键方向更新');
});

test('A 键近战：击杀相邻史莱姆并获得 XP', () => {
  const g = makeGame();
  addMonster(g, 'slime', 11, 10); // 玩家 (10,10) 正下方
  autoAttack(g); // 伤害 8(短剑)+5 = 13 > 12
  assert.equal(monsterAt(g, 11, 10), null);
  assert.equal(g.player.xp, 3);
  assert.equal(g.player.r, 10); // 攻击不位移
  assert.equal(g.turns, 1);
});

test('XP 升级：跨过阈值提升攻击与生命上限', () => {
  const g = makeGame();
  g.player.xp = 9;
  addMonster(g, 'slime', 11, 10);
  autoAttack(g); // +3 XP = 12 ≥ 10 → 升 2 级
  assert.equal(g.player.level, 2);
  assert.equal(g.player.baseAtk, 7);
  assert.equal(g.player.maxHp, 46);
  assert.equal(g.player.hp, 46);
});

test('射手：箭矢命中直线上第一个怪物', () => {
  const g = makeGame();
  g.player.weapon = { class: 'archer', tier: 1, name: '短弓' }; // 伤害 6+5=11
  const near = addMonster(g, 'slime', 10, 12);
  const far = addMonster(g, 'slime', 10, 15);
  autoAttack(g); // 自动锁定最近的 near，穿透未习得，不波及 far
  assert.equal(near.hp, 12 - 11);
  assert.equal(far.hp, 12); // 未波及
});

test('射手：目标在墙后不可见时无目标可打，不耗回合', () => {
  const g = makeGame();
  g.player.weapon = { class: 'archer', tier: 1, name: '短弓' };
  g.map[10 * MAP_W + 12] = 0; // 弹道中间的墙
  const m = addMonster(g, 'slime', 10, 15);
  computeFov(g);
  autoAttack(g);
  assert.equal(m.hp, 12);
  assert.equal(g.turns, 0); // 没有可攻击的目标，不消耗回合
});

test('穿透：箭矢穿过第一个命中怪物继续飞', () => {
  const g = makeGame();
  g.player.weapon = { class: 'archer', tier: 1, name: '短弓' };
  g.player.skills.pierce = 1;
  const near = addMonster(g, 'slime', 10, 12);
  const far = addMonster(g, 'slime', 10, 15);
  autoAttack(g);
  assert.equal(near.hp, 12 - 11);
  assert.equal(far.hp, 12 - 11);
});

test('法杖：形态在火焰/冰霜间切换并附加灼烧', () => {
  const g = makeGame();
  g.player.weapon = { class: 'staff', tier: 1, name: '学徒法杖' }; // 伤害 5+5=10
  const m = addMonster(g, 'orc', 10, 14); // 35 血，保证两发不死
  assert.equal(g.player.form, 'fire');
  autoAttack(g); // 火焰：命中 10 点 + 附加灼烧，回合末灼烧结算 3 点
  assert.equal(m.hp, 35 - 10 - 3);
  assert.equal(m.effects.burnTurns, 2); // 已结算 1 回合
  assert.equal(m.effects.burnDmg, 3);
  assert.equal(g.player.form, 'frost'); // 自动切换
  autoAttack(g); // 冰霜：命中 10 点 + 灼烧再结算 3 点
  assert.equal(m.hp, 35 - 10 - 3 - 10 - 3);
  assert.ok(m.effects.slow > 0);
  assert.equal(g.player.form, 'fire');
});

test('减速：怪物每隔一回合才行动', () => {
  const g = makeGame();
  g.player.weapon = { class: 'staff', tier: 1, name: '学徒法杖' };
  g.player.form = 'frost';
  const m = addMonster(g, 'skeleton', 10, 14);
  autoAttack(g); // 命中并减速；本回合怪物阶段被跳过
  assert.equal(m.c, 14, '被减速当回合不行动');
  wait(g); // 第二回合可以行动 → BFS 追击一步
  assert.equal(m.c, 13);
  wait(g); // 第三回合又被跳过
  assert.equal(m.c, 13);
  wait(g); // 减速结束后的相位：正常行动
  assert.equal(m.c, 12);
});

test('骷髅：攻击附加中毒 DoT', () => {
  const g = makeGame();
  addMonster(g, 'skeleton', 11, 10); // 相邻，进入回合即攻击
  wait(g);
  assert.equal(g.player.poisonTurns, 3);
  const hp1 = g.player.hp;
  wait(g); // 中毒 2 + 骷髅攻击 5
  assert.equal(hp1 - g.player.hp, 7);
});

test('技能书：站上后按 S 拾取学得、可叠加', () => {
  const g = makeGame();
  const base = playerAttack(g);
  g.items.push({ kind: 'skill', r: 11, c: 10, skill: 'power' });
  move(g, 1, 0); // 走到道具格，不自动拾取
  assert.equal(g.player.skills.power, 0);
  pickUp(g);
  assert.equal(g.player.skills.power, 1);
  assert.equal(playerAttack(g), base + 3);
  g.items.push({ kind: 'skill', r: 12, c: 10, skill: 'power' });
  move(g, 1, 0);
  assert.equal(g.player.skills.power, 1); // 第二本也不自动拾取
  pickUp(g);
  assert.equal(g.player.skills.power, 2);
  assert.equal(playerAttack(g), base + 6); // 叠加
});

test('坚韧：拾取后生命上限提升并回血', () => {
  const g = makeGame();
  g.items.push({ kind: 'skill', r: 11, c: 10, skill: 'tough' });
  move(g, 1, 0);
  assert.equal(g.player.maxHp, 40); // 未拾取前不变
  pickUp(g);
  assert.equal(g.player.maxHp, 50);
  assert.equal(g.player.hp, 50);
});

test('武器换装：拾取时换装，旧武器留在该格', () => {
  const g = makeGame();
  g.items.push({ kind: 'weapon', r: 11, c: 10, weapon: { class: 'archer', tier: 2, name: '长弓' } });
  move(g, 1, 0);
  assert.equal(g.player.weapon.name, '短剑'); // 站上不换装
  pickUp(g);
  assert.equal(g.player.weapon.name, '长弓');
  const left = g.items.find(it => it.r === 11 && it.c === 10);
  assert.ok(left);
  assert.deepEqual(left.weapon, { class: 'melee', tier: 1, name: '短剑' }); // 旧武器留在原地
});

test('血包：拾取回复固定血量且不超上限', () => {
  const g = makeGame();
  g.player.hp = 10;
  g.items.push({ kind: 'health', r: 11, c: 10, amount: 15 });
  move(g, 1, 0);
  assert.equal(g.player.hp, 10); // 站上不回血
  pickUp(g);
  assert.equal(g.player.hp, 25);
  g.player.hp = 38;
  g.items.push({ kind: 'health', r: 12, c: 10, amount: 15 });
  move(g, 1, 0);
  pickUp(g);
  assert.equal(g.player.hp, 40); // 不超上限
});

test('道具不自动拾取：站上后等待、移动离开都不生效', () => {
  const g = makeGame();
  g.items.push({ kind: 'skill', r: 11, c: 10, skill: 'power' });
  move(g, 1, 0); // 站上
  assert.equal(g.player.skills.power, 0);
  wait(g); // 站在上面等待
  assert.equal(g.player.skills.power, 0);
  move(g, 0, 1); // 移动离开
  assert.equal(g.player.skills.power, 0);
  assert.ok(g.items.some(it => it.r === 11 && it.c === 10), '道具仍在原地');
});

test('pickUp：脚下无道具时提示且不耗回合', () => {
  const g = makeGame();
  pickUp(g);
  assert.equal(g.turns, 0);
  assert.ok(g.log.some(l => l.includes('这里没有道具')));
});

test('pickUp：满血时血包不消耗、不耗回合', () => {
  const g = makeGame(); // 满血 40/40
  g.items.push({ kind: 'health', r: 11, c: 10, amount: 15 });
  move(g, 1, 0);
  const turns = g.turns;
  pickUp(g);
  assert.equal(g.player.hp, 40);
  assert.equal(g.turns, turns); // 不耗回合
  assert.ok(g.items.some(it => it.kind === 'health'), '血包留在原地');
  assert.ok(g.log.some(l => l.includes('生命已满')));
});

test('pickUp：成功拾取消耗一回合（怪物行动）', () => {
  const g = makeGame();
  g.items.push({ kind: 'skill', r: 11, c: 10, skill: 'power' });
  const slime = addMonster(g, 'slime', 10, 14); // 距离 4，已发现玩家，每回合追 2 格
  move(g, 1, 0); // 第 1 回合：史莱姆追到 (10,12)
  pickUp(g);     // 第 2 回合：拾取技能书，史莱姆继续追到相邻
  assert.equal(g.turns, 2);
  assert.equal(g.player.skills.power, 1, '技能书已被拾取');
  assert.ok(Math.abs(slime.r - 11) <= 1 && Math.abs(slime.c - 10) <= 1,
    '怪物在拾取回合行动（追击到相邻）');
  wait(g); // 第 3 回合：相邻的史莱姆出手
  assert.ok(g.player.hp < 40, '怪物行动包含攻击');
});

test('楼梯：踩上下行进入下一层并回满生命', () => {
  const g = createGame({ seed: 5 });
  calm(g);
  g.player.hp = 5;
  g.player.r = g.stairs.r; g.player.c = g.stairs.c;
  descend(g);
  assert.equal(g.floor, 2);
  assert.equal(g.player.hp, g.player.maxHp); // 回满
  assert.ok(g.stairs, '第 2 层应有楼梯');
});

test('第 3 层竞技场：整层单房间，喵喵汪汪进场即可见', () => {
  const g = createGame({ seed: 5 });
  calm(g);
  g.rng = seededRng(99);
  generateFloor(g, 3);
  calm(g);
  assert.equal(g.rooms.length, 1, '整层只有一个竞技场房间');
  const meow = g.monsters.find(m => m.type === 'meow');
  const woof = g.monsters.find(m => m.type === 'woof');
  assert.ok(meow && woof);
  assert.ok(g.visible[meow.r * MAP_W + meow.c], '喵喵在玩家视野内');
  assert.ok(g.visible[woof.r * MAP_W + woof.c], '汪汪在玩家视野内');
  assert.equal(g.stairs, null);
});

test('第 5 层竞技场：整层单房间，镜像进场即可见', () => {
  const g = createGame({ seed: 5 });
  calm(g);
  g.rng = seededRng(99);
  generateFloor(g, 5);
  calm(g);
  assert.equal(g.rooms.length, 1, '整层只有一个竞技场房间');
  const mirror = g.monsters.find(m => m.type === 'mirror');
  assert.ok(mirror);
  assert.ok(g.visible[mirror.r * MAP_W + mirror.c], '镜像在玩家视野内');
  assert.equal(g.stairs, null);
});

test('下潜到第 3 层：踩第 2 层楼梯直接进入 Boss 竞技场', () => {
  const g = createGame({ seed: 5 });
  calm(g);
  gotoFloor(g, 3);
  const meow = g.monsters.find(m => m.type === 'meow');
  const woof = g.monsters.find(m => m.type === 'woof');
  assert.ok(meow && woof, '双 Boss 在场');
  assert.ok(g.visible[meow.r * MAP_W + meow.c] || g.visible[woof.r * MAP_W + woof.c],
    '进场至少看到一个 Boss');
});

test('第 3 层：双 Boss 全灭后才出现楼梯', () => {
  const g = createGame({ seed: 5 });
  calm(g);
  gotoFloor(g, 3);
  const meow = g.monsters.find(m => m.type === 'meow');
  const woof = g.monsters.find(m => m.type === 'woof');
  assert.ok(meow && woof);
  assert.equal(g.stairs, null); // Boss 未灭，无楼梯
  for (let i = 0; i < 9; i++) { // 打空 9 条命（每次清掉复活当回合的无敌）
    meow.invincibleTurns = 0;
    damageMonster(g, meow, 999, 'test');
  }
  assert.equal(meow.alive, false);
  assert.equal(g.stairs, null); // 汪汪还活着
  damageMonster(g, woof, 9999, 'test');
  assert.ok(g.stairs, '双 Boss 全灭后出现楼梯');
});

test('喵喵：9 条命，每条命被杀后原地复活且当回合无敌', () => {
  const g = createGame({ seed: 5 });
  calm(g);
  gotoFloor(g, 3);
  const meow = g.monsters.find(m => m.type === 'meow');
  g.player.hp = 10000; // 防止测试中被围殴致死
  assert.equal(meow.lives, 9);
  damageMonster(g, meow, 999, 'test'); // 打掉一条命
  assert.equal(meow.alive, true);
  assert.equal(meow.lives, 8);
  assert.equal(meow.hp, meow.maxHp); // 原地满血复活
  assert.equal(meow.invincibleTurns, 1);
  damageMonster(g, meow, 999, 'test'); // 复活当回合无敌
  assert.equal(meow.hp, meow.maxHp);
  assert.equal(meow.lives, 8);
  wait(g); // 过一回合，无敌结束
  damageMonster(g, meow, 999, 'test');
  assert.equal(meow.lives, 7);
});

test('汪汪：每隔 4 回合召唤小狗，场上存活上限 4 只', () => {
  const g = createGame({ seed: 5 });
  calm(g);
  gotoFloor(g, 3);
  const woof = g.monsters.find(m => m.type === 'woof');
  // 把玩家挪到汪汪身边使其发现玩家，血量拉满避免被打死
  g.player.r = woof.r; g.player.c = woof.c + 3;
  g.player.hp = 100000; g.player.maxHp = 100000;
  for (let i = 0; i < 30; i++) wait(g);
  const puppies = g.monsters.filter(m => m.alive && m.type === 'puppy');
  assert.equal(puppies.length, 4); // 达到上限后不再增加
  for (let i = 0; i < 10; i++) wait(g);
  assert.equal(g.monsters.filter(m => m.alive && m.type === 'puppy').length, 4);
});

test('镜像：生成时复制玩家武器系与技能，数值高于玩家', () => {
  const g = createGame({ seed: 5 });
  calm(g);
  g.player.weapon = { class: 'staff', tier: 2, name: '术士法杖' };
  g.player.skills = { power: 2, tough: 1, cleave: 0, pierce: 0, empower: 1 };
  const expectedAtk = playerAttack(g);
  g.rng = seededRng(99); // 生成地图需要真随机源
  generateFloor(g, 5);
  calm(g);
  const mirror = g.monsters.find(m => m.type === 'mirror');
  assert.ok(mirror);
  assert.equal(mirror.weapon.class, 'staff'); // 复制武器系
  assert.deepEqual(mirror.skills, g.player.skills); // 复制技能
  assert.equal(mirror.maxHp, Math.round(g.player.maxHp * 1.5)); // 数值 1.5 倍
  assert.equal(mirror.atk, Math.round(expectedAtk * 1.5));
  assert.equal(g.stairs, null); // 第 5 层无楼梯
});

test('第 5 层：杀死最终 Boss 判胜', () => {
  const g = createGame({ seed: 5 });
  calm(g);
  g.rng = seededRng(99); // 生成地图需要真随机源
  generateFloor(g, 5);
  calm(g);
  const mirror = g.monsters.find(m => m.type === 'mirror');
  g.player.r = mirror.r - 1; g.player.c = mirror.c;
  mirror.hp = 1;
  autoAttack(g); // A 键近战锁定相邻镜像，一击必杀
  assert.equal(g.status, 'won');
});

test('BFS：绕开墙壁找到通路', () => {
  const g = makeGame();
  for (let r = 0; r <= 8; r++) g.map[r * MAP_W + 15] = 0; // 竖墙，第 9 行留缺口
  const path = findPath(g, 4, 10, 4, 20);
  assert.ok(path, '应找到绕墙路径');
  assert.ok(path.length > 10, '绕墙路径比直线长');
  assert.deepEqual(path[path.length - 1], { r: 4, c: 20 });
  for (const step of path) assert.equal(g.map[step.r * MAP_W + step.c], 1, '路径不穿墙');
  // 完全封死则不可达
  for (let r = 0; r < MAP_H; r++) g.map[r * MAP_W + 15] = 0;
  assert.equal(findPath(g, 4, 10, 4, 20), null);
});

test('史莱姆：一回合移动 2 格', () => {
  const g = makeGame();
  const m = addMonster(g, 'slime', 10, 15); // 距离 5，发现玩家
  wait(g);
  assert.equal(m.c, 13); // BFS 追击了两步
});

test('终局后操作无效：移动/攻击/下梯都不再生效', () => {
  const g = makeGame();
  g.player.hp = 1;
  addMonster(g, 'orc', 11, 10); // 相邻，一击必杀
  wait(g);
  assert.equal(g.status, 'lost');
  const { r, c } = g.player;
  const monsCount = g.monsters.filter(m => m.alive).length;
  move(g, 0, 1);
  autoAttack(g);
  descend(g);
  assert.equal(g.player.r, r);
  assert.equal(g.player.c, c);
  assert.equal(g.monsters.filter(m => m.alive).length, monsCount);
  assert.equal(g.floor, 1);
});

test('FOV：可见格进入记忆，墙后不可见', () => {
  const g = makeGame();
  g.map[10 * MAP_W + 13] = 0; // 玩家 (10,10) 右侧 3 格处的墙
  computeFov(g);
  assert.equal(g.visible[10 * MAP_W + 10], true); // 自身可见
  assert.equal(g.visible[10 * MAP_W + 12], true); // 墙前可见
  assert.equal(g.visible[10 * MAP_W + 14], false); // 墙后不可见
  assert.equal(g.memory[10 * MAP_W + 12], true); // 看过的进记忆
  assert.equal(g.visible[10 * MAP_W + 30], false); // 超出半径不可见
});

// ---------- 自动锁定普通攻击（A 键） ----------
test('autoAttack 近战：自动攻击相邻 8 格中 HP 最低的怪物', () => {
  const g = makeGame();
  const full = addMonster(g, 'slime', 11, 10); // 满血 12
  const weak = addMonster(g, 'slime', 9, 10);
  weak.hp = 5; // 残血，应被优先锁定
  autoAttack(g);
  assert.equal(weak.alive, false); // 13 点伤害秒杀残血怪
  assert.equal(full.hp, 12); // 满血怪未被波及
  assert.equal(g.turns, 1);
});

test('autoAttack 近战：周围无怪时提示且不耗回合', () => {
  const g = makeGame();
  addMonster(g, 'slime', 10, 15); // 距离 5，不相邻
  autoAttack(g);
  assert.equal(g.turns, 0);
  assert.ok(g.log.some(l => l.includes('附近没有怪物')));
});

test('autoAttack 射手：最近目标被墙挡（不可见）时攻击次近目标', () => {
  const g = makeGame();
  g.player.weapon = { class: 'archer', tier: 1, name: '短弓' }; // 伤害 11
  g.map[10 * MAP_W + 11] = 0; // 挡住右侧视线
  const blocked = addMonster(g, 'slime', 10, 12); // 墙后，不可见
  const next = addMonster(g, 'slime', 12, 10);     // 下方，可见
  computeFov(g);
  autoAttack(g);
  assert.equal(blocked.hp, 12); // 墙后目标不受攻击
  assert.equal(next.hp, 12 - 11);
  assert.equal(g.turns, 1);
});

test('autoAttack 射手：视野内无怪时提示且不耗回合', () => {
  const g = makeGame();
  g.player.weapon = { class: 'archer', tier: 1, name: '短弓' };
  g.map[10 * MAP_W + 11] = 0;
  addMonster(g, 'slime', 10, 12); // 唯一的怪在墙后
  computeFov(g);
  autoAttack(g);
  assert.equal(g.turns, 0);
  assert.ok(g.log.some(l => l.includes('没有可攻击的目标')));
});

// ---------- 世界节拍（worldTick，浏览器层定时器驱动） ----------
test('worldTick：玩家不做任何动作，发现的怪物逐 tick 逼近并出手', () => {
  const g = makeGame();
  const slime = addMonster(g, 'slime', 10, 15); // 距离 5，已发现玩家，每回合 2 格
  worldTick(g); // tick 1：追到 (10,13)
  assert.equal(slime.c, 13);
  worldTick(g); // tick 2：追到 (10,11)，相邻
  assert.equal(slime.c, 11);
  assert.equal(g.player.hp, 40); // 尚未出手
  worldTick(g); // tick 3：相邻，出手攻击
  assert.equal(g.turns, 3);
  assert.ok(g.player.hp < 40, '玩家不动也会被攻击');
});

test('worldTick：未发现的怪物不逼近（游荡也不直线接近）', () => {
  const g = makeGame();
  const m = addMonster(g, 'skeleton', 10, 20); // 距离 10 > 8，未发现
  worldTick(g);
  worldTick(g);
  worldTick(g);
  assert.equal(m.aware, false);
  assert.equal(m.c, 20); // calm rng 下游荡也不移动，总之不会直线逼近
  assert.equal(g.player.hp, 40);
});

test('worldTick：结算 DoT（怪物灼烧 + 玩家中毒）', () => {
  const g = makeGame();
  const m = addMonster(g, 'skeleton', 10, 19); // 距离 9，不发现不干扰
  m.effects.burnTurns = 2;
  m.effects.burnDmg = 3;
  g.player.poisonTurns = 2;
  g.player.poisonDmg = 2;
  worldTick(g);
  assert.equal(m.hp, 20 - 3, '灼烧在 worldTick 中结算');
  assert.equal(m.effects.burnTurns, 1);
  assert.equal(g.player.hp, 40 - 2, '中毒在 worldTick 中结算');
  assert.equal(g.player.poisonTurns, 1);
});

test('worldTick：终局后幂等，不再推进世界', () => {
  const g = makeGame();
  g.player.hp = 1;
  addMonster(g, 'orc', 11, 10);
  worldTick(g); // 兽人出手，玩家死亡
  assert.equal(g.status, 'lost');
  const turns = g.turns;
  worldTick(g);
  worldTick(g);
  assert.equal(g.turns, turns); // 终局后 turns 不再增长
});

// ---------- 骷髅弓手（远程怪）与攻击事件 fx ----------
test('骷髅弓手：视线内且距离 2~7 时原地射箭攻击玩家', () => {
  const g = makeGame();
  const m = addMonster(g, 'skeleton_archer', 10, 15); // 同行距离 5，发现玩家
  worldTick(g);
  assert.equal(g.player.hp, 40 - 4);
  assert.equal(m.c, 15, '射箭时原地不动');
  assert.ok(g.fx.some(e => e.kind === 'shot' &&
    e.from.r === 10 && e.from.c === 15 && e.to.r === 10 && e.to.c === 10 && e.elem === 'arrow'),
    '产生 shot fx');
  assert.ok(g.fx.some(e => e.kind === 'hit' && e.r === 10 && e.c === 10 && e.dmg === 4),
    '产生玩家受击 hit fx');
});

test('骷髅弓手：被墙挡时不射箭，改为 BFS 逼近', () => {
  const g = makeGame();
  g.map[10 * MAP_W + 12] = 0; // 弹道中间的墙
  const m = addMonster(g, 'skeleton_archer', 10, 15);
  worldTick(g);
  assert.equal(g.player.hp, 40, '被墙挡不射箭');
  assert.ok(m.r !== 10 || m.c !== 15, '离开原位改道逼近');
  assert.ok(!g.fx.some(e => e.kind === 'shot'));
  for (let i = 0; i < 6; i++) worldTick(g); // 绕墙进入斜线射程后仍会出手
  assert.ok(g.player.hp < 40, '绕墙逼近后最终发起攻击');
});

test('骷髅弓手：距离过近转为近战，过远先逼近', () => {
  // 过近（cheb 1）：近战攻击，不射箭
  const g = makeGame();
  const m = addMonster(g, 'skeleton_archer', 10, 11);
  worldTick(g);
  assert.equal(g.player.hp, 40 - 4);
  assert.ok(!g.fx.some(e => e.kind === 'shot'), '近身不产 shot fx');
  assert.ok(g.fx.some(e => e.kind === 'melee'));
  // 过远（cheb 8 > 射程 7）：先逼近
  const g2 = makeGame();
  const m2 = addMonster(g2, 'skeleton_archer', 10, 18); // 距离 8，刚够发现
  worldTick(g2);
  assert.equal(g2.player.hp, 40, '超出射程不射箭');
  assert.equal(m2.c, 17, '先向玩家逼近');
});

test('fx 事件：玩家近战与射手自动攻击的事件内容正确', () => {
  const g = makeGame();
  addMonster(g, 'slime', 11, 10);
  autoAttack(g); // A 键近战
  assert.ok(g.fx.some(e => e.kind === 'melee' &&
    e.from.r === 10 && e.from.c === 10 && e.to.r === 11 && e.to.c === 10));
  assert.ok(g.fx.some(e => e.kind === 'hit' && e.r === 11 && e.c === 10 && e.dmg === 13));
  const g2 = makeGame();
  g2.player.weapon = { class: 'archer', tier: 1, name: '短弓' };
  addMonster(g2, 'slime', 10, 13);
  autoAttack(g2);
  assert.ok(g2.fx.some(e => e.kind === 'shot' &&
    e.from.r === 10 && e.from.c === 10 && e.to.r === 10 && e.to.c === 13 && e.elem === 'arrow'));
});

test('镜像：复制射手武器时以远程方式攻击玩家', () => {
  const g = createGame({ seed: 5 });
  calm(g);
  g.player.weapon = { class: 'archer', tier: 1, name: '短弓' }; // 玩家攻击 11
  g.rng = seededRng(99);
  generateFloor(g, 5);
  calm(g);
  const mirror = g.monsters.find(m => m.type === 'mirror');
  assert.ok(mirror.ranged, '复制射手时镜像获得远程能力');
  // 清场：玩家与镜像同行相距 5，满足射击条件
  g.map.fill(1);
  g.monsters = [mirror];
  g.player.r = mirror.r; g.player.c = mirror.c + 5;
  worldTick(g);
  assert.equal(g.player.hp, 40 - Math.round(11 * 1.5));
  assert.ok(g.fx.some(e => e.kind === 'shot' && e.from.r === mirror.r && e.from.c === mirror.c));
});

// ---------- 空击动画（附近无怪时 A 键仍产生 fx） ----------
test('朝向：随移动更新，撞怪被挡也更新', () => {
  const g = makeGame();
  assert.deepEqual(g.player.dir, { dr: 1, dc: 0 }); // 默认朝下
  move(g, 0, 1);
  assert.deepEqual(g.player.dir, { dr: 0, dc: 1 });
  addMonster(g, 'slime', 11, 11);
  move(g, 1, 0); // 撞怪被挡，朝向仍更新
  assert.deepEqual(g.player.dir, { dr: 1, dc: 0 });
});

test('空击：近战无怪时朝朝向挥空，产生 fx 不耗回合', () => {
  const g = makeGame(); // 周围无怪，朝向默认朝下
  autoAttack(g);
  assert.equal(g.turns, 0);
  assert.ok(g.log.some(l => l.includes('附近没有怪物')));
  assert.ok(g.fx.some(e => e.kind === 'melee' &&
    e.from.r === 10 && e.from.c === 10 && e.to.r === 11 && e.to.c === 10),
    '挥向朝向的相邻格');
});

test('空击：射手弹丸沿朝向飞到墙前，不耗回合', () => {
  const g = makeGame();
  g.player.weapon = { class: 'archer', tier: 1, name: '短弓' };
  g.map[13 * MAP_W + 10] = 0; // 朝向（下）上的墙
  computeFov(g);
  const slime = addMonster(g, 'slime', 10, 20); // 远处怪，验证它没动
  autoAttack(g);
  assert.equal(g.turns, 0);
  assert.equal(slime.c, 20, '不耗回合，怪物不行动');
  assert.ok(g.fx.some(e => e.kind === 'shot' &&
    e.from.r === 10 && e.from.c === 10 && e.to.r === 12 && e.to.c === 10 && e.elem === 'arrow'),
    '弹丸终点为墙前一格');
});

test('空击：法杖空射也切换火焰/冰霜形态', () => {
  const g = makeGame();
  g.player.weapon = { class: 'staff', tier: 1, name: '学徒法杖' };
  assert.equal(g.player.form, 'fire');
  autoAttack(g); // 空射（fire）
  assert.equal(g.player.form, 'frost');
  assert.ok(g.fx.some(e => e.kind === 'shot' && e.elem === 'fire'));
  assert.equal(g.turns, 0);
  autoAttack(g); // 空射（frost）
  assert.equal(g.player.form, 'fire');
  assert.ok(g.fx.some(e => e.kind === 'shot' && e.elem === 'frost'));
});
