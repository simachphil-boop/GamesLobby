// TYCOON board data: tile layout, prices/rents, and six original themed boards
// (names and art are original to BOARDVERSE).

// type: go | street | rail | util | event | fund | tax | jail | parking | gotojail
// street: [group, price, houseCost, rents(base,1,2,3,4,hotel)]
export const TILES = [
  { type: 'go' },
  { type: 'street', g: 0, price: 60, house: 50, rent: [2, 10, 30, 90, 160, 250] },
  { type: 'fund' },
  { type: 'street', g: 0, price: 60, house: 50, rent: [4, 20, 60, 180, 320, 450] },
  { type: 'tax', amount: 200 },
  { type: 'rail', price: 200 },
  { type: 'street', g: 1, price: 100, house: 50, rent: [6, 30, 90, 270, 400, 550] },
  { type: 'event' },
  { type: 'street', g: 1, price: 100, house: 50, rent: [6, 30, 90, 270, 400, 550] },
  { type: 'street', g: 1, price: 120, house: 50, rent: [8, 40, 100, 300, 450, 600] },
  { type: 'jail' },
  { type: 'street', g: 2, price: 140, house: 100, rent: [10, 50, 150, 450, 625, 750] },
  { type: 'util', price: 150 },
  { type: 'street', g: 2, price: 140, house: 100, rent: [10, 50, 150, 450, 625, 750] },
  { type: 'street', g: 2, price: 160, house: 100, rent: [12, 60, 180, 500, 700, 900] },
  { type: 'rail', price: 200 },
  { type: 'street', g: 3, price: 180, house: 100, rent: [14, 70, 200, 550, 750, 950] },
  { type: 'fund' },
  { type: 'street', g: 3, price: 180, house: 100, rent: [14, 70, 200, 550, 750, 950] },
  { type: 'street', g: 3, price: 200, house: 100, rent: [16, 80, 220, 600, 800, 1000] },
  { type: 'parking' },
  { type: 'street', g: 4, price: 220, house: 150, rent: [18, 90, 250, 700, 875, 1050] },
  { type: 'event' },
  { type: 'street', g: 4, price: 220, house: 150, rent: [18, 90, 250, 700, 875, 1050] },
  { type: 'street', g: 4, price: 240, house: 150, rent: [20, 100, 300, 750, 925, 1100] },
  { type: 'rail', price: 200 },
  { type: 'street', g: 5, price: 260, house: 150, rent: [22, 110, 330, 800, 975, 1150] },
  { type: 'street', g: 5, price: 260, house: 150, rent: [22, 110, 330, 800, 975, 1150] },
  { type: 'util', price: 150 },
  { type: 'street', g: 5, price: 280, house: 150, rent: [24, 120, 360, 850, 1025, 1200] },
  { type: 'gotojail' },
  { type: 'street', g: 6, price: 300, house: 200, rent: [26, 130, 390, 900, 1100, 1275] },
  { type: 'street', g: 6, price: 300, house: 200, rent: [26, 130, 390, 900, 1100, 1275] },
  { type: 'fund' },
  { type: 'street', g: 6, price: 320, house: 200, rent: [28, 150, 450, 1000, 1200, 1400] },
  { type: 'rail', price: 200 },
  { type: 'event' },
  { type: 'street', g: 7, price: 350, house: 200, rent: [35, 175, 500, 1100, 1300, 1500] },
  { type: 'tax', amount: 100 },
  { type: 'street', g: 7, price: 400, house: 200, rent: [50, 200, 600, 1400, 1700, 2000] },
];
export const RAILS = [5, 15, 25, 35];
export const UTILS = [12, 28];
export const GROUPS = [[1, 3], [6, 8, 9], [11, 13, 14], [16, 18, 19], [21, 23, 24], [26, 27, 29], [31, 32, 34], [37, 39]];
export const isProperty = (i) => ['street', 'rail', 'util'].includes(TILES[i].type);
export const groupOf = (i) => (TILES[i].type === 'street' ? GROUPS[TILES[i].g] : TILES[i].type === 'rail' ? RAILS : TILES[i].type === 'util' ? UTILS : null);

const STREET_IDX = TILES.map((t, i) => (t.type === 'street' ? i : -1)).filter((i) => i >= 0);

// Theme: names for 22 streets (in board order), 4 transports, 2 utilities, palette, colors.
const THEMES = {
  classic: {
    colors: ['#8a5a34', '#9ad6f0', '#d65aa8', '#f08a2a', '#e03a3a', '#f2d23a', '#2fa35a', '#2a4ab8'],
    bg: '#dff0e2', ink: '#1a2a20', center: '#c8e6cf', accent: '#c0392b', motif: 'city',
    streets: {
      en: ['Old Mill Lane', 'Baker Row', 'Maple Avenue', 'Linden Street', 'Willow Road', 'Gallery Square', 'Theatre Lane', 'Opera Walk', 'Harbor Street', "Fisher's Quay", 'Lighthouse Road', 'Market Street', 'Clock Tower Sq.', 'Union Avenue', 'Sunset Blvd', 'Golden Mile', 'Amber Court', 'Emerald Park', 'Garden Terrace', 'Botanic Way', 'Crown Heights', 'Royal Promenade'],
      ru: ['Мельничный пер.', 'Пекарская ул.', 'Кленовый пр.', 'Липовая ул.', 'Ивовая дорога', 'Галерейная пл.', 'Театральный пер.', 'Оперный бульвар', 'Портовая ул.', 'Рыбацкая наб.', 'Маячная дорога', 'Рыночная ул.', 'Пл. Часовой башни', 'Союзный пр.', 'Бульвар Заката', 'Золотая миля', 'Янтарный двор', 'Изумрудный парк', 'Садовая терраса', 'Ботаническая ул.', 'Коронные высоты', 'Королевский променад'],
    },
    rails: { en: ['North Station', 'East Station', 'South Station', 'West Station'], ru: ['Северный вокзал', 'Восточный вокзал', 'Южный вокзал', 'Западный вокзал'] },
    utils: { en: ['Power Plant', 'Water Works'], ru: ['Электростанция', 'Водоканал'] },
  },
  metro: {
    colors: ['#6a4a8a', '#3ad8f0', '#ff4ab0', '#ff8a2a', '#ff3a5a', '#ffe23a', '#3aff9a', '#4a7aff'],
    bg: '#14182e', ink: '#e8f0ff', center: '#0e1224', accent: '#3ad8f0', motif: 'skyline', dark: true,
    streets: {
      en: ['Neon Alley', 'Subway Plaza', 'Tech Park', 'Data Street', 'Cloud Avenue', 'Startup Hub', 'Media Tower', 'Arena Blvd', 'Skyline Road', 'Harbor Bridge', 'Glass Quarter', 'Central Mall', 'Stock Exchange', 'Times Circle', 'Rooftop Gardens', 'Sky Lounge', 'Marina Bay', 'Finance District', 'Corporate Plaza', 'Innovation Way', 'Diamond Tower', 'Platinum Heights'],
      ru: ['Неоновый пер.', 'Площадь Метро', 'Технопарк', 'Улица Данных', 'Облачный пр.', 'Стартап-хаб', 'Медиа-башня', 'Бульвар Арены', 'Небесная дорога', 'Портовый мост', 'Стеклянный квартал', 'Центральный молл', 'Биржа', 'Круг Времени', 'Сады на крыше', 'Небесный лаунж', 'Марина', 'Финансовый район', 'Корпоративная пл.', 'Путь Инноваций', 'Бриллиантовая башня', 'Платиновые высоты'],
    },
    rails: { en: ['Metro Line A', 'Metro Line B', 'Metro Line C', 'Metro Line D'], ru: ['Метро: линия A', 'Метро: линия B', 'Метро: линия C', 'Метро: линия D'] },
    utils: { en: ['Smart Grid', 'Fiber Network'], ru: ['Умная сеть', 'Оптоволокно'] },
  },
  tropic: {
    colors: ['#a0703a', '#4ae0d0', '#ff6aa0', '#ffa03a', '#ff5a3a', '#ffe05a', '#3ac06a', '#2a8ad8'],
    bg: '#fff3d6', ink: '#3a2a10', center: '#9fe6e0', accent: '#ff7a3a', motif: 'palm',
    streets: {
      en: ['Coconut Path', 'Shell Beach', 'Palm Grove', 'Lagoon Drive', 'Coral Reef', 'Parrot Bay', 'Mango Market', 'Hibiscus Hill', 'Surf Point', 'Turtle Cove', 'Banana Docks', 'Volcano View', 'Sunrise Pier', 'Pearl Bay', 'Pineapple Plaza', 'Orchid Gardens', 'Golden Sands', 'Waterfall Road', 'Jungle Lodge', 'Bamboo Resort', 'Sunset Villa', 'Paradise Isle'],
      ru: ['Кокосовая тропа', 'Ракушечный пляж', 'Пальмовая роща', 'Лагунная дорога', 'Коралловый риф', 'Бухта Попугаев', 'Манговый рынок', 'Холм Гибискуса', 'Мыс Серферов', 'Черепашья бухта', 'Банановые доки', 'Вид на вулкан', 'Пирс Рассвета', 'Жемчужный залив', 'Ананасовая пл.', 'Сады орхидей', 'Золотые пески', 'Дорога водопада', 'Лесной домик', 'Бамбуковый курорт', 'Вилла Заката', 'Райский остров'],
    },
    rails: { en: ['North Ferry', 'East Ferry', 'South Ferry', 'West Ferry'], ru: ['Северный паром', 'Восточный паром', 'Южный паром', 'Западный паром'] },
    utils: { en: ['Solar Farm', 'Desalination Plant'], ru: ['Солнечная ферма', 'Опреснитель'] },
  },
  space: {
    colors: ['#8a6a5a', '#7ad0ff', '#d07aff', '#ff9a4a', '#ff4a6a', '#ffe07a', '#5affc0', '#6a7aff'],
    bg: '#0a0c22', ink: '#dfe6ff', center: '#05061a', accent: '#a07aff', motif: 'planet', dark: true,
    streets: {
      en: ['Crater Row', 'Dust Lane', 'Orbit Street', 'Comet Avenue', 'Meteor Way', 'Nebula Plaza', 'Quasar Lane', 'Pulsar Park', 'Mars Colony', 'Red Dunes', 'Olympus Base', 'Asteroid Mine', 'Saturn Rings', 'Jupiter Dock', 'Ion Boulevard', 'Photon Square', 'Galaxy Mall', 'Star Harbor', 'Nova Gardens', 'Cosmos Tower', 'Andromeda Heights', 'Event Horizon'],
      ru: ['Кратерный ряд', 'Пыльный пер.', 'Орбитальная ул.', 'Кометный пр.', 'Метеорный путь', 'Пл. Туманности', 'Квазарный пер.', 'Парк Пульсара', 'Колония Марс', 'Красные дюны', 'База Олимп', 'Астероидная шахта', 'Кольца Сатурна', 'Док Юпитер', 'Ионный бульвар', 'Фотонная пл.', 'Галактический молл', 'Звёздная гавань', 'Сады Новы', 'Башня Космос', 'Высоты Андромеды', 'Горизонт событий'],
    },
    rails: { en: ['Launch Pad 1', 'Launch Pad 2', 'Launch Pad 3', 'Launch Pad 4'], ru: ['Стартовая пл. 1', 'Стартовая пл. 2', 'Стартовая пл. 3', 'Стартовая пл. 4'] },
    utils: { en: ['Fusion Reactor', 'Oxygen Farm'], ru: ['Термоядерный реактор', 'Кислородная ферма'] },
  },
  medieval: {
    colors: ['#7a5a3a', '#8ab0c0', '#b05a8a', '#c07a2a', '#a02a2a', '#d0b03a', '#3a7a3a', '#2a3a7a'],
    bg: '#efe0bf', ink: '#3a2410', center: '#e0cc9a', accent: '#8a2a1a', motif: 'castle',
    streets: {
      en: ['Mud Lane', 'Peasant Row', 'Smithy Street', "Tanner's Way", 'Weaver Lane', 'Monastery Walk', "Bard's Corner", 'Minstrel Court', 'Tavern Square', 'Guild Hall', 'Merchant Row', 'Jousting Field', "Knight's Gate", "Archer's Tower", "Wizard's Lane", 'Alchemist Alley', 'Dragon Bridge', 'Castle Gardens', 'Royal Stables', 'Throne Hall', "King's Keep", 'Crown Citadel'],
      ru: ['Грязный пер.', 'Крестьянский ряд', 'Кузнечная ул.', 'Дубильная ул.', 'Ткацкий пер.', 'Монастырская ул.', 'Угол Барда', 'Двор Менестреля', 'Трактирная пл.', 'Гильдейский зал', 'Купеческий ряд', 'Турнирное поле', 'Рыцарские ворота', 'Башня Лучника', 'Улица Чародея', 'Переулок Алхимика', 'Драконий мост', 'Замковый сад', 'Королевские конюшни', 'Тронный зал', 'Королевская крепость', 'Цитадель Короны'],
    },
    rails: { en: ['North Gate', 'East Gate', 'South Gate', 'West Gate'], ru: ['Северные ворота', 'Восточные ворота', 'Южные ворота', 'Западные ворота'] },
    utils: { en: ['Windmill', 'Water Wheel'], ru: ['Ветряная мельница', 'Водяное колесо'] },
  },
  future: {
    colors: ['#5a8a8a', '#7affff', '#ff7aff', '#ffb07a', '#ff7a8a', '#faff7a', '#7aff9a', '#7a9aff'],
    bg: '#e8f6ff', ink: '#10283a', center: '#d0ecff', accent: '#00a8d8', motif: 'dome',
    streets: {
      en: ['Recycle Row', 'Bio Lane', 'Hover Street', 'Maglev Avenue', 'Drone Way', 'Holo Plaza', 'VR Arcade', 'Robot Market', 'Quantum Lane', 'AI Campus', 'Fusion Square', 'Vertical Farm', 'Sky Garden', 'Cloud City', 'Ocean Dome', 'Arcology', 'Zero Gravity', 'Teleport Hub', 'Nano Tower', 'Starlight Spire', 'Utopia Heights', 'Infinity Plaza'],
      ru: ['Ряд переработки', 'Био-переулок', 'Ховер-улица', 'Маглев-проспект', 'Путь дронов', 'Голо-площадь', 'VR-аркада', 'Рынок роботов', 'Квантовый пер.', 'Кампус ИИ', 'Пл. Синтеза', 'Вертикальная ферма', 'Небесный сад', 'Облачный город', 'Океанский купол', 'Аркология', 'Невесомость', 'Телепорт-хаб', 'Нано-башня', 'Звёздный шпиль', 'Высоты Утопии', 'Пл. Бесконечности'],
    },
    rails: { en: ['Hyperloop 1', 'Hyperloop 2', 'Hyperloop 3', 'Hyperloop 4'], ru: ['Гиперлуп 1', 'Гиперлуп 2', 'Гиперлуп 3', 'Гиперлуп 4'] },
    utils: { en: ['Wind Array', 'Solar Sail'], ru: ['Ветряной массив', 'Солнечный парус'] },
  },
};
export const BOARD_IDS = Object.keys(THEMES);
export const boardTheme = (id) => THEMES[id] || THEMES.classic;

const SPECIAL = {
  go: { en: 'START', ru: 'СТАРТ' }, jail: { en: 'JAIL · Just visiting', ru: 'ТЮРЬМА · Проездом' }, parking: { en: 'FREE REST', ru: 'ОТДЫХ' },
  gotojail: { en: 'GO TO JAIL', ru: 'В ТЮРЬМУ' }, event: { en: 'EVENT', ru: 'СОБЫТИЕ' }, fund: { en: 'FUND', ru: 'ФОНД' },
  tax4: { en: 'Income Tax', ru: 'Подоходный налог' }, tax38: { en: 'Luxury Tax', ru: 'Налог на роскошь' },
};

export function tileName(board, i, lang) {
  const th = boardTheme(board);
  const tl = TILES[i];
  const L = (o) => o[lang] || o.en;
  if (tl.type === 'street') return L(th.streets)[STREET_IDX.indexOf(i)];
  if (tl.type === 'rail') return L(th.rails)[RAILS.indexOf(i)];
  if (tl.type === 'util') return L(th.utils)[UTILS.indexOf(i)];
  if (tl.type === 'tax') return L(SPECIAL['tax' + i]);
  return L(SPECIAL[tl.type]);
}

// ---------- cards ----------
// kind: move(to) | moveRel(n) | nearest(rail|util) | money(+/-) | jail | jailCard | repairs(h,H) | payEach | collectEach
export const EVENT_CARDS = [
  { k: 'move', to: 0, en: 'Advance to START. Collect your salary.', ru: 'Отправляйтесь на СТАРТ и получите зарплату.' },
  { k: 'move', to: 24, en: 'Take a trip to {24}.', ru: 'Поездка: {24}.' },
  { k: 'move', to: 11, en: 'Advance to {11}.', ru: 'Перейдите на {11}.' },
  { k: 'nearest', what: 'rail', en: 'Go to the nearest transport. If owned, pay double rent.', ru: 'Идите к ближайшему транспорту. Если он занят — двойная аренда.' },
  { k: 'nearest', what: 'rail', en: 'Go to the nearest transport. If owned, pay double rent.', ru: 'Идите к ближайшему транспорту. Если он занят — двойная аренда.' },
  { k: 'nearest', what: 'util', en: 'Go to the nearest utility. If owned, pay 10× the dice.', ru: 'Идите к ближайшему предприятию. Если оно занято — 10× кубики.' },
  { k: 'money', v: 50, en: 'Your startup pays a dividend: +50.', ru: 'Ваш стартап выплатил дивиденды: +50.' },
  { k: 'jailCard', en: 'Free Pass! Keep this card to leave jail for free.', ru: 'Пропуск! Сохраните карту, чтобы выйти из тюрьмы бесплатно.' },
  { k: 'moveRel', n: -3, en: 'Forgot your keys — go back 3 spaces.', ru: 'Забыли ключи — вернитесь на 3 клетки.' },
  { k: 'jail', en: 'Caught jaywalking! Go directly to jail.', ru: 'Перешли дорогу на красный! Отправляйтесь в тюрьму.' },
  { k: 'repairs', h: 25, H: 100, en: 'Renovation time: pay 25 per house and 100 per hotel.', ru: 'Ремонт: 25 за каждый дом и 100 за каждый отель.' },
  { k: 'money', v: -15, en: 'Parking ticket: −15.', ru: 'Штраф за парковку: −15.' },
  { k: 'move', to: 5, en: 'Catch a ride from {5}.', ru: 'Поездка от: {5}.' },
  { k: 'move', to: 39, en: 'You are invited to {39}.', ru: 'Вас пригласили в: {39}.' },
  { k: 'payEach', v: 50, en: 'You host a party: pay every player 50.', ru: 'Вы устраиваете вечеринку: заплатите каждому по 50.' },
  { k: 'money', v: 150, en: 'Your investment matures: +150.', ru: 'Ваша инвестиция созрела: +150.' },
];
export const FUND_CARDS = [
  { k: 'move', to: 0, en: 'Advance to START. Collect your salary.', ru: 'Отправляйтесь на СТАРТ и получите зарплату.' },
  { k: 'money', v: 200, en: 'Bank glitch in your favor: +200.', ru: 'Сбой в банке в вашу пользу: +200.' },
  { k: 'money', v: -50, en: 'Dentist visit: −50.', ru: 'Визит к стоматологу: −50.' },
  { k: 'money', v: 50, en: 'You sold an old guitar: +50.', ru: 'Вы продали старую гитару: +50.' },
  { k: 'jailCard', en: 'Free Pass! Keep this card to leave jail for free.', ru: 'Пропуск! Сохраните карту, чтобы выйти из тюрьмы бесплатно.' },
  { k: 'jail', en: 'Mistaken identity! Go directly to jail.', ru: 'Вас с кем-то перепутали! Отправляйтесь в тюрьму.' },
  { k: 'money', v: 100, en: 'Holiday savings pay out: +100.', ru: 'Отпускные накопления: +100.' },
  { k: 'money', v: 20, en: 'Tax refund: +20.', ru: 'Возврат налога: +20.' },
  { k: 'collectEach', v: 10, en: "It's your birthday! Collect 10 from every player.", ru: 'У вас день рождения! Каждый игрок дарит вам 10.' },
  { k: 'money', v: 100, en: 'Life insurance matures: +100.', ru: 'Страховка выплачена: +100.' },
  { k: 'money', v: -100, en: 'Hospital bill: −100.', ru: 'Счёт из больницы: −100.' },
  { k: 'money', v: -50, en: 'Course fees: −50.', ru: 'Оплата курсов: −50.' },
  { k: 'money', v: 25, en: 'Consulting fee: +25.', ru: 'Гонорар за консультацию: +25.' },
  { k: 'repairs', h: 40, H: 115, en: 'Street repairs: pay 40 per house and 115 per hotel.', ru: 'Ремонт улиц: 40 за дом и 115 за отель.' },
  { k: 'money', v: 10, en: 'Second prize in a talent show: +10.', ru: 'Второе место в конкурсе талантов: +10.' },
  { k: 'money', v: 100, en: 'You inherit 100.', ru: 'Вы получили наследство: +100.' },
];
