
const LS_KEY = 'animepulse.v2.state';
const JIKAN = 'https://api.jikan.moe/v4';
const ANILIST = 'https://graphql.anilist.co';

const STATUS_META = {
  watching:  { label: 'Viendo',      color: '#34d399' },
  plan:      { label: 'Pendientes',  color: '#38bdf8' },
  completed: { label: 'Completados', color: '#a78bfa' },
  onhold:    { label: 'En pausa',    color: '#fbbf24' },
  dropped:   { label: 'Abandonados', color: '#fb7185' }
};
const STATUS_ORDER = ['watching','plan','completed','onhold','dropped'];

const MOCK_ANIME = [
  { id:'mal_21', title:'One Piece', studio:'Toei Animation', genres:['Shonen','Adventure','Action','Fantasy'], year:1999, malScore:8.72, malEpisodes:0, airing:true, watched:12, status:'watching', rating:null, trailerId:'', posterHue:null,
    image:'https://cdn.myanimelist.net/images/anime/1244/138851.jpg', synopsis:'Sigue las aventuras de Monkey D. Luffy y su tripulación pirata en su búsqueda del legendario tesoro One Piece.' },
  { id:'mal_40748', title:'Jujutsu Kaisen', studio:'MAPPA', genres:['Shonen','Action','Supernatural'], year:2020, malScore:8.63, malEpisodes:24, airing:false, watched:24, status:'completed', rating:9, trailerId:'pCcZ9M3u2_E', posterHue:null,
    image:'https://cdn.myanimelist.net/images/anime/1171/109222.jpg', synopsis:'Un estudiante se traga un dedo maldito y se convierte en el anfitrión de un demonio ancestral.' },
  { id:'mal_52991', title:'Sousou no Frieren', studio:'Madhouse', genres:['Fantasy','Adventure','Drama'], year:2023, malScore:9.33, malEpisodes:28, airing:false, watched:4, status:'watching', rating:10, trailerId:'9kFtxe9Lbso', posterHue:null,
    image:'https://cdn.myanimelist.net/images/anime/1015/138006.jpg', synopsis:'Tras derrotar al Rey Demonio, la elfa Frieren emprende un viaje para entender la efímera vida de los humanos.' },
  { id:'mal_40028', title:'Shingeki no Kyojin', studio:'MAPPA', genres:['Shonen','Action','Drama','Mystery'], year:2013, malScore:8.55, malEpisodes:25, airing:false, watched:20, status:'watching', rating:8, trailerId:'', posterHue:null,
    image:'https://cdn.myanimelist.net/images/anime/1571/134525.jpg', synopsis:'La humanidad se refugia tras tres murallas para protegerse de los titanes.' },
  { id:'mal_44511', title:'Chainsaw Man', studio:'MAPPA', genres:['Shonen','Action','Horror'], year:2022, malScore:8.51, malEpisodes:12, airing:false, watched:0, status:'plan', rating:null, trailerId:'loT-HX0I7hg', posterHue:null,
    image:'https://cdn.myanimelist.net/images/anime/1806/126216.jpg', synopsis:'Denji, un cazador de demonios endeudado, se fusiona con su mascota demonio para convertirse en Chainsaw Man.' },
  { id:'mal_38000', title:'Kimetsu no Yaiba', studio:'ufotable', genres:['Shonen','Action','Supernatural'], year:2019, malScore:8.38, malEpisodes:26, airing:false, watched:12, status:'watching', rating:8, trailerId:'yjUQEAjTm2E', posterHue:null,
    image:'https://cdn.myanimelist.net/images/anime/1286/128707.jpg', synopsis:'Tanjiro se convierte en cazador de demonios para devolver a su hermana a la forma humana.' },
  { id:'mal_5114', title:'Fullmetal Alchemist: Brotherhood', studio:'Bones', genres:['Shonen','Action','Adventure','Drama','Fantasy'], year:2009, malScore:9.09, malEpisodes:64, airing:false, watched:0, status:'plan', rating:null, trailerId:'', posterHue:null,
    image:'https://cdn.myanimelist.net/images/anime/1223/96541.jpg', synopsis:'Dos hermanos alquimistas buscan la piedra filosofal para restaurar sus cuerpos.' },
  { id:'mal_37999', title:'Kaguya-sama: Love is War', studio:'A-1 Pictures', genres:['Romance','Comedy','School'], year:2019, malScore:8.4, malEpisodes:12, airing:false, watched:12, status:'completed', rating:7, trailerId:'', posterHue:null,
    image:'https://cdn.myanimelist.net/images/anime/1295/106551.jpg', synopsis:'Dos prodigios del consejo estudiantil libran una guerra romántica de orgullo.' },
  { id:'mal_9253', title:'Steins;Gate', studio:'White Fox', genres:['Sci-Fi','Thriller','Drama'], year:2011, malScore:9.03, malEpisodes:24, airing:false, watched:6, status:'watching', rating:null, trailerId:'', posterHue:null,
    image:'https://cdn.myanimelist.net/images/anime/1935/127974.jpg', synopsis:'Un científico loco descubre que puede enviar mensajes al pasado.' },
  { id:'mal_33352', title:'Violet Evergarden', studio:'Kyoto Animation', genres:['Drama','Fantasy','Slice of Life'], year:2018, malScore:8.74, malEpisodes:13, airing:false, watched:13, status:'completed', rating:10, trailerId:'', posterHue:null,
    image:'https://cdn.myanimelist.net/images/anime/1795/95088.jpg', synopsis:'Una ex-soldado se convierte en Auto Memories Doll escribiendo cartas para otros.' },
  { id:'mal_4752', title:'Bakemonogatari', studio:'Shaft', genres:['Mystery','Supernatural','Romance'], year:2009, malScore:8.9, malEpisodes:15, airing:false, watched:2, status:'onhold', rating:null, trailerId:'', posterHue:null,
    image:'https://cdn.myanimelist.net/images/anime/1956/94915.jpg', synopsis:'Un estudiante se involucra con chicas afectadas por apariciones sobrenaturales.' },
  { id:'mal_30654', title:'Tokyo Ghoul', studio:'Pierrot', genres:['Seinen','Action','Horror','Drama'], year:2014, malScore:7.82, malEpisodes:12, airing:false, watched:4, status:'dropped', rating:4, trailerId:'', posterHue:null,
    image:'https://cdn.myanimelist.net/images/anime/1498/101851.jpg', synopsis:'Un universitario se convierte en medio ghoul tras un trasplante de órganos.' }
];

let state = {
  filter: 'watching',
  view: 'grid',
  settings: { detectPlayers: true, autoIncrement: true, notifications: true, theme: 'dark', accent: 'purple', autoAdd: true, syncOn: false, alClientId: '', alToken: '', dcEnabled: false, dcClientId: '', autoOrganize: false, kitsuOn: false, kitsuClientId: '', kitsuSecret: '', kitsuEmail: '', kitsuToken: '', kitsuUserId: null, asOn: false, asToken: '' },
  animeList: [],
  activity: [2,3,1,4,2,5,3],
  calendarDay: 'monday',
  calendarTouched: false,
  scrobbler: { running: false, player: 'VLC Player', animeId: null, episodeNow: 0, progress: 0, fileName: null, timer: null, source: 'manual', increment: true },
  searchCache: {},
  lastSearch: '',
  airNotified: {},
  folder: null,
  files: [],
  gamification: { level: 1, xp: 0, coins: 0, marathon: 0, totalEpisodes: 0, totalCompleted: 0, lastAnimeId: null, seasonPass: null, boughtRanks: [], ownerVerified: false },
  profile: { name: 'Otaku Tracker', rank: 'basico', bio: '', accent: 'purple', avatar: '' }
};

