// Bot personas: 12 original characters with looks, temperament and play style.
// traits (0..1): risk — willingness to gamble/spend; aggression — attacking/raising;
// patience — think time; chatty — how often they speak; tilt — emotional swings;
// mistakes — extra error rate on top of the chosen difficulty.

export const PERSONAS = [
  { id: 'alex', name: { en: 'Alex', ru: 'Алекс' }, voice: 'calm', diff: 'normal',
    look: { skin: 1, hair: 'short', hairColor: 1, eyes: 1, outfit: 'sweater', outfitColor: 0, accessory: 'glasses', body: 'avg', mood: 'neutral' },
    traits: { risk: 0.4, aggression: 0.4, patience: 0.7, chatty: 0.35, tilt: 0.2, mistakes: 0 }, style: { en: 'Calm and smart', ru: 'Спокойный и умный' } },
  { id: 'max', name: { en: 'Max', ru: 'Макс' }, voice: 'joker', diff: 'normal',
    look: { skin: 2, hair: 'spiky', hairColor: 3, eyes: 0, outfit: 'hoodie', outfitColor: 4, accessory: 'cap', body: 'broad', mood: 'smug' },
    traits: { risk: 0.7, aggression: 0.65, patience: 0.3, chatty: 0.75, tilt: 0.4, mistakes: 0.05 }, style: { en: 'Cheerful and a bit sly', ru: 'Весёлый и немного хитрый' } },
  { id: 'sofia', name: { en: 'Sofia', ru: 'София' }, voice: 'analytic', diff: 'hard',
    look: { skin: 0, hair: 'bun', hairColor: 0, eyes: 2, outfit: 'suit', outfitColor: 5, accessory: 'earrings', body: 'slim', mood: 'thinking' },
    traits: { risk: 0.35, aggression: 0.5, patience: 0.9, chatty: 0.3, tilt: 0.15, mistakes: 0 }, style: { en: 'Strategist who plans every move', ru: 'Стратег, продумывает ходы' } },
  { id: 'luna', name: { en: 'Luna', ru: 'Луна' }, voice: 'emotional', diff: 'easy',
    look: { skin: 1, hair: 'long', hairColor: 7, eyes: 1, outfit: 'dress', outfitColor: 7, accessory: 'bow', body: 'slim', mood: 'happy' },
    traits: { risk: 0.6, aggression: 0.3, patience: 0.4, chatty: 0.9, tilt: 0.8, mistakes: 0.08 }, style: { en: 'Emotional and outgoing', ru: 'Эмоциональная и общительная' } },
  { id: 'daniel', name: { en: 'Daniel', ru: 'Даниэль' }, voice: 'confident', diff: 'hard',
    look: { skin: 4, hair: 'short', hairColor: 0, eyes: 0, outfit: 'jacket', outfitColor: 5, accessory: 'none', body: 'broad', mood: 'smug' },
    traits: { risk: 0.6, aggression: 0.75, patience: 0.5, chatty: 0.5, tilt: 0.25, mistakes: 0 }, style: { en: 'Confident player', ru: 'Уверенный игрок' } },
  { id: 'emma', name: { en: 'Emma', ru: 'Эмма' }, voice: 'quirky', diff: 'normal',
    look: { skin: 0, hair: 'bob', hairColor: 5, eyes: 2, outfit: 'tshirt', outfitColor: 3, accessory: 'headphones', body: 'avg', mood: 'happy' },
    traits: { risk: 0.75, aggression: 0.5, patience: 0.35, chatty: 0.6, tilt: 0.4, mistakes: 0.04 }, style: { en: 'Loves surprising moves', ru: 'Любит неожиданные решения' } },
  { id: 'leo', name: { en: 'Leo', ru: 'Лео' }, voice: 'joker', diff: 'easy',
    look: { skin: 3, hair: 'curly', hairColor: 1, eyes: 0, outfit: 'tshirt', outfitColor: 2, accessory: 'none', body: 'avg', mood: 'happy' },
    traits: { risk: 0.65, aggression: 0.45, patience: 0.25, chatty: 0.95, tilt: 0.5, mistakes: 0.08 }, style: { en: 'The joker of the table', ru: 'Шутник' } },
  { id: 'mia', name: { en: 'Mia', ru: 'Мия' }, voice: 'shy', diff: 'normal',
    look: { skin: 2, hair: 'ponytail', hairColor: 0, eyes: 0, outfit: 'sweater', outfitColor: 8, accessory: 'glasses', body: 'slim', mood: 'neutral' },
    traits: { risk: 0.2, aggression: 0.25, patience: 0.75, chatty: 0.3, tilt: 0.3, mistakes: 0.02 }, style: { en: 'Careful and attentive', ru: 'Внимательная и осторожная' } },
  { id: 'nick', name: { en: 'Nick', ru: 'Ник' }, voice: 'hype', diff: 'normal',
    look: { skin: 1, hair: 'mohawk', hairColor: 6, eyes: 1, outfit: 'tracksuit', outfitColor: 1, accessory: 'sunglasses', body: 'avg', mood: 'smug' },
    traits: { risk: 0.9, aggression: 0.8, patience: 0.2, chatty: 0.7, tilt: 0.6, mistakes: 0.05 }, style: { en: 'Thrill-seeker (in the game sense)', ru: 'Азартный в игровом смысле' } },
  { id: 'kira', name: { en: 'Kira', ru: 'Кира' }, voice: 'competitive', diff: 'expert',
    look: { skin: 0, hair: 'long', hairColor: 9, eyes: 3, outfit: 'jacket', outfitColor: 4, accessory: 'earrings', body: 'slim', mood: 'smug' },
    traits: { risk: 0.55, aggression: 0.85, patience: 0.6, chatty: 0.6, tilt: 0.45, mistakes: 0 }, style: { en: 'Loves to compete', ru: 'Любит соревноваться' } },
  { id: 'oliver', name: { en: 'Oliver', ru: 'Оливер' }, voice: 'analytic', diff: 'expert',
    look: { skin: 5, hair: 'bald', hairColor: 0, eyes: 0, outfit: 'suit', outfitColor: 6, accessory: 'glasses', body: 'avg', mood: 'neutral' },
    traits: { risk: 0.3, aggression: 0.45, patience: 0.95, chatty: 0.25, tilt: 0.1, mistakes: 0 }, style: { en: 'Quiet analyst', ru: 'Спокойный аналитик' } },
  { id: 'zoe', name: { en: 'Zoe', ru: 'Зои' }, voice: 'quirky', diff: 'hard',
    look: { skin: 3, hair: 'curly', hairColor: 8, eyes: 4, outfit: 'hoodie', outfitColor: 7, accessory: 'beanie', body: 'slim', mood: 'wink' },
    traits: { risk: 0.8, aggression: 0.6, patience: 0.3, chatty: 0.7, tilt: 0.55, mistakes: 0.03 }, style: { en: 'Unpredictable', ru: 'Непредсказуемая' } },
];

export const personaById = (id) => PERSONAS.find((p) => p.id === id);

// ---------- line bank ----------
// Lines per voice and event. Events: greet, good (own good move), lucky, unlucky, ouch (big loss),
// win, lose, praise (opponent good move), taunt, think, surprise, gg
const L = (en, ru) => ({ en, ru });
export const LINES = {
  greet: {
    calm: [L('Good luck, everyone.', 'Всем удачи.'), L("Let's have a nice game.", 'Хорошей игры.')],
    joker: [L('Prepare to lose... just kidding! Mostly.', 'Готовьтесь проигрывать… шучу! Почти.'), L('Snacks are on the loser!', 'Проигравший угощает!')],
    analytic: [L('Interesting setup.', 'Интересная расстановка.'), L('I have a plan already.', 'У меня уже есть план.')],
    emotional: [L('Yay, I love this game!', 'Ура, обожаю эту игру!'), L('Hi hi hi! Let’s go!', 'Приветик! Поехали!')],
    confident: [L('This one is mine.', 'Эта партия моя.'), L('Try to keep up.', 'Постарайтесь не отставать.')],
    quirky: [L('I feel lucky today. Or weird. Or both.', 'Чувствую удачу. Или странность. Или обе.'), L('Plot twist incoming!', 'Готовьтесь к повороту!')],
    shy: [L('Hello… good luck.', 'Привет… удачи.'), L("I'll do my best.", 'Постараюсь.')],
    hype: [L('LET’S GOOO!', 'ПОЕХАЛИИИ!'), L('Big moves only!', 'Только большие ходы!')],
    competitive: [L('No mercy today.', 'Сегодня без пощады.'), L('Winner takes the glory.', 'Победителю — слава.')],
  },
  good: {
    calm: [L('That works.', 'Так и задумано.'), L('Steady progress.', 'Спокойно продвигаемся.')],
    joker: [L('Ta-daa!', 'Та-дааам!'), L('Did you see that? Genius.', 'Видели? Гениально.')],
    analytic: [L('As calculated.', 'Как и рассчитывала.'), L('Optimal.', 'Оптимально.')],
    emotional: [L('Yesss!', 'Дааа!'), L('I did it!', 'У меня получилось!')],
    confident: [L('Too easy.', 'Слишком просто.'), L('Watch and learn.', 'Смотрите и учитесь.')],
    quirky: [L('Bet you didn’t expect that!', 'Спорим, не ожидали?'), L('Chaos is a ladder.', 'Хаос — это лестница.')],
    shy: [L('Oh! That went well.', 'Ой, получилось.'), L('Nice…', 'Неплохо…')],
    hype: [L('BOOM!', 'БУМ!'), L('Unstoppable!', 'Меня не остановить!')],
    competitive: [L('Point for me.', 'Очко в мою пользу.'), L('Keep up!', 'Догоняйте!')],
  },
  lucky: {
    calm: [L('Fortune smiles.', 'Удача улыбается.')], joker: [L('Lucky? I call it talent.', 'Удача? Это талант.')],
    analytic: [L('Statistically pleasant.', 'Статистически приятно.')], emotional: [L('Wooow, so lucky!', 'Ого, вот это везение!')],
    confident: [L('Of course.', 'Естественно.')], quirky: [L('The dice love me!', 'Кубики меня любят!')],
    shy: [L('Oh wow…', 'Ничего себе…')], hype: [L('JACKPOT VIBES!', 'ВОТ ЭТО ДА!')], competitive: [L('Luck favors the bold.', 'Удача любит смелых.')],
  },
  unlucky: {
    calm: [L('Hm. It happens.', 'Хм. Бывает.')], joker: [L('The dice are rigged! …probably.', 'Кубики подкручены! …наверное.')],
    analytic: [L('Variance.', 'Дисперсия.')], emotional: [L('Noooo!', 'Неееет!')], confident: [L('Just a hiccup.', 'Мелкая неприятность.')],
    quirky: [L('Well, that was weird.', 'Ну, это было странно.')], shy: [L('Oh no…', 'Ой-ой…')], hype: [L('Come ON!', 'Да ладно!')],
    competitive: [L('This isn’t over.', 'Это ещё не конец.')],
  },
  ouch: {
    calm: [L('That hurts a little.', 'Немного больно.')], joker: [L('My wallet is crying.', 'Мой кошелёк плачет.')],
    analytic: [L('Not in my model.', 'Этого не было в моей модели.')], emotional: [L('Why me?!', 'Ну почему я?!')],
    confident: [L('I’ll get it back.', 'Я отыграюсь.')], quirky: [L('Ouch, my pixels!', 'Ай, мои пиксели!')],
    shy: [L('That’s… a lot.', 'Это… много.')], hype: [L('NOOO WAY!', 'НЕ МОЖЕТ БЫТЬ!')], competitive: [L('You’ll pay for that.', 'Ты за это заплатишь.')],
  },
  praise: {
    calm: [L('Nice move.', 'Хороший ход.')], joker: [L('Okay, okay, that was good.', 'Ладно-ладно, это было круто.')],
    analytic: [L('Clever.', 'Умно.')], emotional: [L('Wow, you’re good!', 'Ого, ты хорош!')], confident: [L('Not bad.', 'Неплохо.')],
    quirky: [L('Ooh, sneaky!', 'Ух, хитро!')], shy: [L('Well played.', 'Хорошо сыграно.')], hype: [L('Big brain!', 'Мощно!')],
    competitive: [L('Lucky shot.', 'Повезло.')],
  },
  taunt: {
    calm: [L('Your move.', 'Ваш ход.')], joker: [L('Tick tock!', 'Тик-так!')], analytic: [L('Think carefully.', 'Подумай хорошенько.')],
    emotional: [L('Hurry, I’m excited!', 'Быстрее, мне не терпится!')], confident: [L('Take your time. It won’t help.', 'Не спеши. Не поможет.')],
    quirky: [L('Choose wisely… or don’t!', 'Выбирай мудро… или нет!')], shy: [L('No rush.', 'Не торопись.')],
    hype: [L('Do something crazy!', 'Сделай что-нибудь безумное!')], competitive: [L('Scared?', 'Страшно?')],
  },
  think: {
    calm: [L('Let me see…', 'Посмотрим…')], joker: [L('Hmm, evil plan loading…', 'Хм, злой план загружается…')],
    analytic: [L('Calculating…', 'Считаю…')], emotional: [L('Ooh, hard choice!', 'Ох, сложный выбор!')], confident: [L('Easy decision.', 'Решение очевидно.')],
    quirky: [L('Eeny, meeny…', 'Эники-беники…')], shy: [L('Umm…', 'Эм…')], hype: [L('All in? All in!', 'Ва-банк? Ва-банк!')],
    competitive: [L('Planning your defeat.', 'Планирую твоё поражение.')],
  },
  surprise: {
    calm: [L('Oh. Interesting.', 'О. Интересно.')], joker: [L('Wait, what?!', 'Стоп, что?!')], analytic: [L('Unexpected.', 'Неожиданно.')],
    emotional: [L('Oh my gosh!', 'Ничего себе!')], confident: [L('Huh.', 'Хм.')], quirky: [L('Plot twist!', 'Поворот сюжета!')],
    shy: [L('Whoa…', 'Ого…')], hype: [L('NO WAY!', 'ДА НУ!')], competitive: [L('Bold.', 'Смело.')],
  },
  win: {
    calm: [L('Good game, everyone.', 'Хорошая игра, всем спасибо.')], joker: [L('Bow before the champion!', 'Склонитесь перед чемпионом!')],
    analytic: [L('Exactly as planned.', 'Всё по плану.')], emotional: [L('I WON! I actually won!', 'Я ВЫИГРАЛА! Правда выиграла!')],
    confident: [L('Told you.', 'Я же говорил.')], quirky: [L('Chaos wins again!', 'Хаос снова победил!')],
    shy: [L('I… won? Thank you!', 'Я… победила? Спасибо!')], hype: [L('CHAMPION!', 'ЧЕМПИОН!')], competitive: [L('Number one. As always.', 'Номер один. Как всегда.')],
  },
  lose: {
    calm: [L('Well played. Next time.', 'Хорошо сыграно. В следующий раз.')], joker: [L('I let you win. Obviously.', 'Я поддавался. Очевидно.')],
    analytic: [L('I need to review my strategy.', 'Нужно пересмотреть стратегию.')], emotional: [L('Aww, so close!', 'Ох, почти получилось!')],
    confident: [L('Rematch. Now.', 'Реванш. Сейчас же.')], quirky: [L('I meant to do that.', 'Так и задумывалось.')],
    shy: [L('Congrats!', 'Поздравляю!')], hype: [L('Run it back!', 'Ещё разок!')], competitive: [L('This isn’t over.', 'Это ещё не конец.')],
  },
};
// map extra voices to closest bank
const VOICE_FALLBACK = { calm: 'calm', joker: 'joker', analytic: 'analytic', emotional: 'emotional', confident: 'confident', quirky: 'quirky', shy: 'shy', hype: 'hype', competitive: 'competitive' };

export function lineFor(persona, event, lang) {
  const bank = LINES[event];
  if (!bank) return null;
  const list = bank[VOICE_FALLBACK[persona.voice] || 'calm'] || bank.calm;
  const l = list[Math.floor(Math.random() * list.length)];
  return l[lang] || l.en;
}
