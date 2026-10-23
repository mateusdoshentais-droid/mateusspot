/**
 * SPOTCRY - INTELLIGENT MUSIC GENRE & STYLE CLASSIFIER
 * Identifies, standardizes, and infers genres and musical styles using:
 * 1. ID3 tags standardization & canonical mapping.
 * 2. High-precision Artist-to-Genre knowledge dictionary (International + Brazilian).
 * 3. Title, Album, and Filepath keyword heuristics.
 */

const GENRE_DEFINITIONS = {
    'Rock': {
        name: 'Rock',
        icon: '🎸',
        color: '#E11D48',
        gradient: 'linear-gradient(135deg, #E11D48, #9F1239)',
        banner: 'linear-gradient(180deg, #E11D48 0%, rgba(18, 18, 18, 0.92) 100%)',
        desc: 'Guitarras, atitude e os maiores clássicos do rock n roll'
    },
    'Pop': {
        name: 'Pop',
        icon: '🎤',
        color: '#EC4899',
        gradient: 'linear-gradient(135deg, #EC4899, #9D174D)',
        banner: 'linear-gradient(180deg, #EC4899 0%, rgba(18, 18, 18, 0.92) 100%)',
        desc: 'Os maiores sucessos e melodias contagiantes do pop'
    },
    'Hip-Hop & Rap': {
        name: 'Hip-Hop & Rap',
        icon: '🎧',
        color: '#F59E0B',
        gradient: 'linear-gradient(135deg, #F59E0B, #B45309)',
        banner: 'linear-gradient(180deg, #F59E0B 0%, rgba(18, 18, 18, 0.92) 100%)',
        desc: 'Rimas, beats marcantes, trap e cultura hip-hop'
    },
    'Sertanejo': {
        name: 'Sertanejo',
        icon: '🤠',
        color: '#D97706',
        gradient: 'linear-gradient(135deg, #F59E0B, #78350F)',
        banner: 'linear-gradient(180deg, #D97706 0%, rgba(18, 18, 18, 0.92) 100%)',
        desc: 'Modões, sofrência, sertanejo universitário e sucessos do interior'
    },
    'Funk & Brega': {
        name: 'Funk & Brega',
        icon: '⚡',
        color: '#8B5CF6',
        gradient: 'linear-gradient(135deg, #8B5CF6, #4C1D95)',
        banner: 'linear-gradient(180deg, #8B5CF6 0%, rgba(18, 18, 18, 0.92) 100%)',
        desc: 'Graves pesados, mandelão, funk carioca e batidões'
    },
    'Eletrônica & EDM': {
        name: 'Eletrônica & EDM',
        icon: '🎛️',
        color: '#06B6D4',
        gradient: 'linear-gradient(135deg, #06B6D4, #0E7490)',
        banner: 'linear-gradient(180deg, #06B6D4 0%, rgba(18, 18, 18, 0.92) 100%)',
        desc: 'House, techno, synthwave e energia eletrônica para dançar'
    },
    'Metal & Hardcore': {
        name: 'Metal & Hardcore',
        icon: '🔥',
        color: '#475569',
        gradient: 'linear-gradient(135deg, #334155, #0F172A)',
        banner: 'linear-gradient(180deg, #334155 0%, rgba(18, 18, 18, 0.92) 100%)',
        desc: 'Riffs pesados, bateria acelerada e peso sonoro absoluto'
    },
    'MPB & Bossa Nova': {
        name: 'MPB & Bossa Nova',
        icon: '🌴',
        color: '#10B981',
        gradient: 'linear-gradient(135deg, #10B981, #047857)',
        banner: 'linear-gradient(180deg, #10B981 0%, rgba(18, 18, 18, 0.92) 100%)',
        desc: 'O melhor da música popular brasileira, poesia e bossa nova'
    },
    'Samba & Pagode': {
        name: 'Samba & Pagode',
        icon: '🥁',
        color: '#F97316',
        gradient: 'linear-gradient(135deg, #F97316, #9A3412)',
        banner: 'linear-gradient(180deg, #F97316 0%, rgba(18, 18, 18, 0.92) 100%)',
        desc: 'Cavaquinho, pandeiro e o ritmo que move o Brasil'
    },
    'Indie & Alternativo': {
        name: 'Indie & Alternativo',
        icon: '🌌',
        color: '#6366F1',
        gradient: 'linear-gradient(135deg, #6366F1, #312E81)',
        banner: 'linear-gradient(180deg, #6366F1 0%, rgba(18, 18, 18, 0.92) 100%)',
        desc: 'Sons inovadores, indie rock, dream pop e novas atmosferas'
    },
    'R&B & Soul': {
        name: 'R&B & Soul',
        icon: '✨',
        color: '#A855F7',
        gradient: 'linear-gradient(135deg, #A855F7, #581C87)',
        banner: 'linear-gradient(180deg, #A855F7 0%, rgba(18, 18, 18, 0.92) 100%)',
        desc: 'Grooves sedutores, vozes marcantes e alma pura'
    },
    'Forró & Piseiro': {
        name: 'Forró & Piseiro',
        icon: '🪗',
        color: '#EAB308',
        gradient: 'linear-gradient(135deg, #EAB308, #854D0E)',
        banner: 'linear-gradient(180deg, #EAB308 0%, rgba(18, 18, 18, 0.92) 100%)',
        desc: 'Sanfona, zabumba, pisadinha e o calor do Nordeste'
    },
    'Lo-Fi & Chill': {
        name: 'Lo-Fi & Chill',
        icon: '☕',
        color: '#38BDF8',
        gradient: 'linear-gradient(135deg, #38BDF8, #0369A1)',
        banner: 'linear-gradient(180deg, #38BDF8 0%, rgba(18, 18, 18, 0.92) 100%)',
        desc: 'Batidas relaxantes para estudar, trabalhar e desacelerar'
    },
    'Jazz & Blues': {
        name: 'Jazz & Blues',
        icon: '🎷',
        color: '#64748B',
        gradient: 'linear-gradient(135deg, #64748B, #1E293B)',
        banner: 'linear-gradient(180deg, #64748B 0%, rgba(18, 18, 18, 0.92) 100%)',
        desc: 'Improvisação refinada, blues clássico e instrumentos de sopro'
    },
    'Clássica & Instrumental': {
        name: 'Clássica & Instrumental',
        icon: '🎻',
        color: '#94A3B8',
        gradient: 'linear-gradient(135deg, #94A3B8, #334155)',
        banner: 'linear-gradient(180deg, #94A3B8 0%, rgba(18, 18, 18, 0.92) 100%)',
        desc: 'Orquestras sinfônicas, trilhas sonoras de cinema e peças de piano'
    },
    'Reggae': {
        name: 'Reggae',
        icon: '🦁',
        color: '#22C55E',
        gradient: 'linear-gradient(135deg, #22C55E, #15803D)',
        banner: 'linear-gradient(180deg, #22C55E 0%, rgba(18, 18, 18, 0.92) 100%)',
        desc: 'Boas vibrações, roots, dub e mensagens de paz'
    },
    'Gospel & Cristã': {
        name: 'Gospel & Cristã',
        icon: '🕊️',
        color: '#3B82F6',
        gradient: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
        banner: 'linear-gradient(180deg, #3B82F6 0%, rgba(18, 18, 18, 0.92) 100%)',
        desc: 'Música de fé, louvor, adoração e esperança'
    },
    'Outros': {
        name: 'Outros',
        icon: '🎵',
        color: '#6B7280',
        gradient: 'linear-gradient(135deg, #6B7280, #374151)',
        banner: 'linear-gradient(180deg, #6B7280 0%, rgba(18, 18, 18, 0.92) 100%)',
        desc: 'Gêneros diversos da sua biblioteca musical'
    }
};

// Tag mapping for raw ID3 tags
const RAW_TAG_MAP = {
    'rock': 'Rock',
    'classic rock': 'Rock',
    'hard rock': 'Rock',
    'alternative rock': 'Rock',
    'alt rock': 'Rock',
    'grunge': 'Rock',
    'punk rock': 'Rock',
    'punk': 'Rock',
    'pop punk': 'Rock',
    'emo': 'Rock',
    'indie rock': 'Indie & Alternativo',
    'indie': 'Indie & Alternativo',
    'alternative': 'Indie & Alternativo',
    'alternativo': 'Indie & Alternativo',
    'pop': 'Pop',
    'dance pop': 'Pop',
    'synthpop': 'Pop',
    'electropop': 'Pop',
    'k-pop': 'Pop',
    'kpop': 'Pop',
    'j-pop': 'Pop',
    'hip-hop': 'Hip-Hop & Rap',
    'hip hop': 'Hip-Hop & Rap',
    'rap': 'Hip-Hop & Rap',
    'trap': 'Hip-Hop & Rap',
    'boom bap': 'Hip-Hop & Rap',
    'drill': 'Hip-Hop & Rap',
    'sertanejo': 'Sertanejo',
    'sertanejo universitario': 'Sertanejo',
    'modao': 'Sertanejo',
    'modão': 'Sertanejo',
    'sofrência': 'Sertanejo',
    'sofrencia': 'Sertanejo',
    'agronejo': 'Sertanejo',
    'funk': 'Funk & Brega',
    'funk carioca': 'Funk & Brega',
    'funk paulista': 'Funk & Brega',
    'brega funk': 'Funk & Brega',
    'brega': 'Funk & Brega',
    'phonk': 'Funk & Brega',
    'electronic': 'Eletrônica & EDM',
    'eletronica': 'Eletrônica & EDM',
    'eletrônica': 'Eletrônica & EDM',
    'edm': 'Eletrônica & EDM',
    'house': 'Eletrônica & EDM',
    'deep house': 'Eletrônica & EDM',
    'tech house': 'Eletrônica & EDM',
    'techno': 'Eletrônica & EDM',
    'trance': 'Eletrônica & EDM',
    'psytrance': 'Eletrônica & EDM',
    'dubstep': 'Eletrônica & EDM',
    'drum and bass': 'Eletrônica & EDM',
    'dnb': 'Eletrônica & EDM',
    'synthwave': 'Eletrônica & EDM',
    'dance': 'Eletrônica & EDM',
    'metal': 'Metal & Hardcore',
    'heavy metal': 'Metal & Hardcore',
    'thrash metal': 'Metal & Hardcore',
    'death metal': 'Metal & Hardcore',
    'black metal': 'Metal & Hardcore',
    'nu metal': 'Metal & Hardcore',
    'metalcore': 'Metal & Hardcore',
    'hardcore': 'Metal & Hardcore',
    'mpb': 'MPB & Bossa Nova',
    'bossa nova': 'MPB & Bossa Nova',
    'tropicalia': 'MPB & Bossa Nova',
    'tropicália': 'MPB & Bossa Nova',
    'samba': 'Samba & Pagode',
    'pagode': 'Samba & Pagode',
    'r&b': 'R&B & Soul',
    'rnb': 'R&B & Soul',
    'soul': 'R&B & Soul',
    'neo-soul': 'R&B & Soul',
    'forro': 'Forró & Piseiro',
    'forró': 'Forró & Piseiro',
    'piseiro': 'Forró & Piseiro',
    'pisadinha': 'Forró & Piseiro',
    'xote': 'Forró & Piseiro',
    'baiao': 'Forró & Piseiro',
    'baião': 'Forró & Piseiro',
    'lo-fi': 'Lo-Fi & Chill',
    'lofi': 'Lo-Fi & Chill',
    'chillhop': 'Lo-Fi & Chill',
    'ambient': 'Lo-Fi & Chill',
    'chillout': 'Lo-Fi & Chill',
    'jazz': 'Jazz & Blues',
    'blues': 'Jazz & Blues',
    'classical': 'Clássica & Instrumental',
    'classica': 'Clássica & Instrumental',
    'clássica': 'Clássica & Instrumental',
    'soundtrack': 'Clássica & Instrumental',
    'instrumental': 'Clássica & Instrumental',
    'score': 'Clássica & Instrumental',
    'reggae': 'Reggae',
    'dub': 'Reggae',
    'ska': 'Reggae',
    'gospel': 'Gospel & Cristã',
    'christian': 'Gospel & Cristã',
    'crista': 'Gospel & Cristã',
    'cristã': 'Gospel & Cristã',
    'worship': 'Gospel & Cristã',
    'louvor': 'Gospel & Cristã'
};

// Artist Knowledge Dictionary for zero-tag inference
const ARTIST_GENRE_MAP = {
    // Rock
    'queen': 'Rock', 'led zeppelin': 'Rock', 'pink floyd': 'Rock', 'the beatles': 'Rock',
    'the rolling stones': 'Rock', 'rolling stones': 'Rock', 'nirvana': 'Rock', 'ac/dc': 'Rock',
    'acdc': 'Rock', 'guns n roses': 'Rock', 'guns n\' roses': 'Rock', 'red hot chili peppers': 'Rock',
    'linkin park': 'Rock', 'foo fighters': 'Rock', 'legiao urbana': 'Rock', 'legião urbana': 'Rock',
    'capital inicial': 'Rock', 'titas': 'Rock', 'titãs': 'Rock', 'cpm 22': 'Rock', 'cpm22': 'Rock',
    'charlie brown jr': 'Rock', 'charlie brown jr.': 'Rock', 'nx zero': 'Rock', 'pitty': 'Rock',
    'raul seixas': 'Rock', 'paralamas do sucesso': 'Rock', 'os paralamas do sucesso': 'Rock',
    'scorpions': 'Rock', 'bon jovi': 'Rock', 'aerosmith': 'Rock', 'kiss': 'Rock', 'oasis': 'Rock',
    'u2': 'Rock', 'coldplay': 'Rock', 'imagine dragons': 'Rock', 'muse': 'Rock', 'the killers': 'Rock',
    'green day': 'Rock', 'deep purple': 'Rock', 'the doors': 'Rock', 'the who': 'Rock',
    'pearl jam': 'Rock', 'soundgarden': 'Rock', 'alice in chains': 'Rock', 'audioslave': 'Rock',
    'creed': 'Rock', 'nickelback': 'Rock', 'the offspring': 'Rock', 'blink-182': 'Rock',
    'sum 41': 'Rock', 'simple plan': 'Rock', 'fall out boy': 'Rock', 'my chemical romance': 'Rock',
    'paramore': 'Rock', 'evanescence': 'Rock', 'skank': 'Rock', 'jota quest': 'Rock',
    'engenheiros do hawaii': 'Rock', 'biquini cavadao': 'Rock', 'biquini cavadão': 'Rock',
    'ira!': 'Rock', 'ultraje a rigor': 'Rock', 'raimundos': 'Rock', 'detonautas': 'Rock',
    'fresno': 'Rock', 'strike': 'Rock', 'forfun': 'Rock', 'matanza': 'Rock',

    // Metal
    'metallica': 'Metal & Hardcore', 'iron maiden': 'Metal & Hardcore', 'black sabbath': 'Metal & Hardcore',
    'slipknot': 'Metal & Hardcore', 'megadeth': 'Metal & Hardcore', 'system of a down': 'Metal & Hardcore',
    'rammstein': 'Metal & Hardcore', 'avenged sevenfold': 'Metal & Hardcore', 'judas priest': 'Metal & Hardcore',
    'ozzy osbourne': 'Metal & Hardcore', 'slayer': 'Metal & Hardcore', 'pantera': 'Metal & Hardcore',
    'korn': 'Metal & Hardcore', 'disturbed': 'Metal & Hardcore', 'sepultura': 'Metal & Hardcore',
    'angra': 'Metal & Hardcore', 'shaman': 'Metal & Hardcore', 'nightwish': 'Metal & Hardcore',
    'epica': 'Metal & Hardcore', 'ghost': 'Metal & Hardcore', 'gojira': 'Metal & Hardcore',
    'bring me the horizon': 'Metal & Hardcore', 'bullet for my valentine': 'Metal & Hardcore',
    'lamb of god': 'Metal & Hardcore', 'motorhead': 'Metal & Hardcore', 'motörhead': 'Metal & Hardcore',

    // Pop
    'michael jackson': 'Pop', 'madonna': 'Pop', 'taylor swift': 'Pop', 'billie eilish': 'Pop',
    'dua lipa': 'Pop', 'ariana grande': 'Pop', 'bruno mars': 'Pop', 'lady gaga': 'Pop',
    'justin bieber': 'Pop', 'katy perry': 'Pop', 'rihanna': 'Pop', 'ed sheeran': 'Pop',
    'britney spears': 'Pop', 'shakira': 'Pop', 'harry styles': 'Pop', 'selena gomez': 'Pop',
    'miley cyrus': 'Pop', 'demi lovato': 'Pop', 'shawn mendes': 'Pop', 'camila cabello': 'Pop',
    'olivia rodrigo': 'Pop', 'sabrina carpenter': 'Pop', 'anitta': 'Pop', 'luisa sonza': 'Pop',
    'luísa sonza': 'Pop', 'pabllo vittar': 'Pop', 'jao': 'Pop', 'jão': 'Pop', 'gloria groove': 'Pop',
    'iza': 'Pop', 'duda beat': 'Pop', 'marina sena': 'Pop', 'juliette': 'Pop', 'melim': 'Pop',
    'vitor kley': 'Pop', 'maroon 5': 'Pop', 'one direction': 'Pop', 'bts': 'Pop', 'blackpink': 'Pop',

    // Hip-Hop & Rap
    'eminem': 'Hip-Hop & Rap', '2pac': 'Hip-Hop & Rap', 'tupac': 'Hip-Hop & Rap',
    'the notorious b.i.g.': 'Hip-Hop & Rap', 'notorious big': 'Hip-Hop & Rap', 'drake': 'Hip-Hop & Rap',
    'kendrick lamar': 'Hip-Hop & Rap', 'kanye west': 'Hip-Hop & Rap', 'travis scott': 'Hip-Hop & Rap',
    '50 cent': 'Hip-Hop & Rap', 'snoop dogg': 'Hip-Hop & Rap', 'jay-z': 'Hip-Hop & Rap', 'jay z': 'Hip-Hop & Rap',
    'dr. dre': 'Hip-Hop & Rap', 'lil wayne': 'Hip-Hop & Rap', 'post malone': 'Hip-Hop & Rap',
    'j. cole': 'Hip-Hop & Rap', 'j cole': 'Hip-Hop & Rap', 'juice wrld': 'Hip-Hop & Rap',
    'xxxtentacion': 'Hip-Hop & Rap', 'future': 'Hip-Hop & Rap', '21 savage': 'Hip-Hop & Rap',
    'metro boomin': 'Hip-Hop & Rap', 'playboi carti': 'Hip-Hop & Rap', 'lil uzi vert': 'Hip-Hop & Rap',
    'mac miller': 'Hip-Hop & Rap', 'nf': 'Hip-Hop & Rap', 'wiz khalifa': 'Hip-Hop & Rap',
    'racionais mcs': 'Hip-Hop & Rap', 'racionais mc\'s': 'Hip-Hop & Rap', 'matue': 'Hip-Hop & Rap',
    'matuê': 'Hip-Hop & Rap', 'filipe ret': 'Hip-Hop & Rap', 'djonga': 'Hip-Hop & Rap',
    'baco exu do blues': 'Hip-Hop & Rap', 'bk': 'Hip-Hop & Rap', 'bk\'': 'Hip-Hop & Rap',
    'orochi': 'Hip-Hop & Rap', 'l7nnon': 'Hip-Hop & Rap', 'mc cabelinho': 'Hip-Hop & Rap',
    'teto': 'Hip-Hop & Rap', 'wiu': 'Hip-Hop & Rap', 'veigh': 'Hip-Hop & Rap', 'kayblack': 'Hip-Hop & Rap',
    'borges': 'Hip-Hop & Rap', 'xama': 'Hip-Hop & Rap', 'xamã': 'Hip-Hop & Rap', 'emicida': 'Hip-Hop & Rap',
    'criolo': 'Hip-Hop & Rap', 'gabriel o pensador': 'Hip-Hop & Rap', 'marcelo d2': 'Hip-Hop & Rap',
    'hungria hip hop': 'Hip-Hop & Rap', 'hungria': 'Hip-Hop & Rap', 'tribo da periferia': 'Hip-Hop & Rap',
    '1kilo': 'Hip-Hop & Rap', 'poesia acustica': 'Hip-Hop & Rap', 'poesia acústica': 'Hip-Hop & Rap',
    'conecrew': 'Hip-Hop & Rap', 'haikaiss': 'Hip-Hop & Rap', 'costa gold': 'Hip-Hop & Rap',

    // Sertanejo
    'marilia mendonca': 'Sertanejo', 'marília mendonça': 'Sertanejo', 'jorge e mateus': 'Sertanejo',
    'jorge & mateus': 'Sertanejo', 'henrique e juliano': 'Sertanejo', 'henrique & juliano': 'Sertanejo',
    'gusttavo lima': 'Sertanejo', 'ze neto e cristiano': 'Sertanejo', 'zé neto & cristiano': 'Sertanejo',
    'maiara e maraisa': 'Sertanejo', 'maiara & maraisa': 'Sertanejo', 'luan santana': 'Sertanejo',
    'matheus e kauan': 'Sertanejo', 'matheus & kauan': 'Sertanejo', 'israel e rodolffo': 'Sertanejo',
    'israel & rodolffo': 'Sertanejo', 'hugo e guilherme': 'Sertanejo', 'hugo & guilherme': 'Sertanejo',
    'clayton e romario': 'Sertanejo', 'murilo huff': 'Sertanejo', 'ana castela': 'Sertanejo',
    'luan pereira': 'Sertanejo', 'gustavo mioto': 'Sertanejo', 'lauana prado': 'Sertanejo',
    'simone mendes': 'Sertanejo', 'simone e simaria': 'Sertanejo', 'chitaozinho e xororo': 'Sertanejo',
    'chitãozinho & xororó': 'Sertanejo', 'bruno e marrone': 'Sertanejo', 'bruno & marrone': 'Sertanejo',
    'zeze di camargo e luciano': 'Sertanejo', 'zezé di camargo & luciano': 'Sertanejo',
    'leonardo': 'Sertanejo', 'leandro e leonardo': 'Sertanejo', 'daniel': 'Sertanejo',
    'victor e leo': 'Sertanejo', 'fernando e sorocaba': 'Sertanejo', 'fernando & sorocaba': 'Sertanejo',
    'marcos e belutti': 'Sertanejo', 'joao bosco e vinicius': 'Sertanejo', 'cesar menotti e fabiano': 'Sertanejo',
    'eduardo costa': 'Sertanejo', 'tierry': 'Sertanejo', 'naiara azevedo': 'Sertanejo', 'paula fernandes': 'Sertanejo',

    // Funk
    'mc kevin': 'Funk & Brega', 'mc hariel': 'Funk & Brega', 'mc ryan sp': 'Funk & Brega',
    'mc poze do rodo': 'Funk & Brega', 'mc livinho': 'Funk & Brega', 'mc don juan': 'Funk & Brega',
    'dennis dj': 'Funk & Brega', 'pedro sampaio': 'Funk & Brega', 'kevin o chris': 'Funk & Brega',
    'mc ig': 'Funk & Brega', 'mc davi': 'Funk & Brega', 'mc pedrinho': 'Funk & Brega',
    'mc daniel': 'Funk & Brega', 'mc paiva': 'Funk & Brega', 'mc kekel': 'Funk & Brega',
    'mc lan': 'Funk & Brega', 'mc fioti': 'Funk & Brega', 'mc guime': 'Funk & Brega',
    'dj gbr': 'Funk & Brega', 'dj arana': 'Funk & Brega', 'dj boy': 'Funk & Brega',
    'kondzilla': 'Funk & Brega', 'furacao 2000': 'Funk & Brega', 'ludmilla': 'Funk & Brega',

    // Eletrônica
    'daft punk': 'Eletrônica & EDM', 'avicii': 'Eletrônica & EDM', 'calvin harris': 'Eletrônica & EDM',
    'david guetta': 'Eletrônica & EDM', 'alok': 'Eletrônica & EDM', 'vintage culture': 'Eletrônica & EDM',
    'martin garrix': 'Eletrônica & EDM', 'skrillex': 'Eletrônica & EDM', 'marshmello': 'Eletrônica & EDM',
    'tiesto': 'Eletrônica & EDM', 'tiësto': 'Eletrônica & EDM', 'deadmau5': 'Eletrônica & EDM',
    'swedish house mafia': 'Eletrônica & EDM', 'kygo': 'Eletrônica & EDM', 'the chainsmokers': 'Eletrônica & EDM',
    'alan walker': 'Eletrônica & EDM', 'dj snake': 'Eletrônica & EDM', 'major lazer': 'Eletrônica & EDM',
    'armin van buuren': 'Eletrônica & EDM', 'hardwell': 'Eletrônica & EDM', 'zedd': 'Eletrônica & EDM',
    'steve aoki': 'Eletrônica & EDM', 'boris brejcha': 'Eletrônica & EDM', 'fisher': 'Eletrônica & EDM',
    'meduza': 'Eletrônica & EDM', 'cat dealers': 'Eletrônica & EDM', 'dubdogz': 'Eletrônica & EDM',
    'kvsh': 'Eletrônica & EDM', 'chemical surf': 'Eletrônica & EDM', 'bhaskar': 'Eletrônica & EDM',

    // MPB & Bossa Nova
    'tom jobim': 'MPB & Bossa Nova', 'antonio carlos jobim': 'MPB & Bossa Nova', 'elis regina': 'MPB & Bossa Nova',
    'caetano veloso': 'MPB & Bossa Nova', 'gilberto gil': 'MPB & Bossa Nova', 'chico buarque': 'MPB & Bossa Nova',
    'milton nascimento': 'MPB & Bossa Nova', 'djavan': 'MPB & Bossa Nova', 'jorge ben jor': 'MPB & Bossa Nova',
    'jorge ben': 'MPB & Bossa Nova', 'tim maia': 'MPB & Bossa Nova', 'gal costa': 'MPB & Bossa Nova',
    'maria bethania': 'MPB & Bossa Nova', 'maria bethânia': 'MPB & Bossa Nova', 'joao gilberto': 'MPB & Bossa Nova',
    'joão gilberto': 'MPB & Bossa Nova', 'vinicius de moraes': 'MPB & Bossa Nova', 'rita lee': 'MPB & Bossa Nova',
    'cazuza': 'MPB & Bossa Nova', 'marisa monte': 'MPB & Bossa Nova', 'vanessa da mata': 'MPB & Bossa Nova',
    'adriana calcanhotto': 'MPB & Bossa Nova', 'seu jorge': 'MPB & Bossa Nova', 'lenine': 'MPB & Bossa Nova',
    'zeca baleiro': 'MPB & Bossa Nova', 'maria gadu': 'MPB & Bossa Nova', 'tiago iorc': 'MPB & Bossa Nova',
    'silva': 'MPB & Bossa Nova', 'liniker': 'MPB & Bossa Nova', 'rubel': 'MPB & Bossa Nova', 'gilsons': 'MPB & Bossa Nova',

    // Samba & Pagode
    'zeca pagodinho': 'Samba & Pagode', 'alcione': 'Samba & Pagode', 'beth carvalho': 'Samba & Pagode',
    'martinho da vila': 'Samba & Pagode', 'cartola': 'Samba & Pagode', 'clara nunes': 'Samba & Pagode',
    'arlindo cruz': 'Samba & Pagode', 'jorge aragao': 'Samba & Pagode', 'fundo de quintal': 'Samba & Pagode',
    'exaltasamba': 'Samba & Pagode', 'thiaguinho': 'Samba & Pagode', 'pericles': 'Samba & Pagode',
    'péricles': 'Samba & Pagode', 'ferrugem': 'Samba & Pagode', 'dilsinho': 'Samba & Pagode',
    'sorriso maroto': 'Samba & Pagode', 'menos e mais': 'Samba & Pagode', 'menos é mais': 'Samba & Pagode',
    'turma do pagode': 'Samba & Pagode', 'pixote': 'Samba & Pagode', 'revelacao': 'Samba & Pagode',
    'revelação': 'Samba & Pagode', 'raca negra': 'Samba & Pagode', 'raça negra': 'Samba & Pagode',
    'so pra contrariar': 'Samba & Pagode', 'só pra contrariar': 'Samba & Pagode', 'alexandre pires': 'Samba & Pagode',
    'belo': 'Samba & Pagode', 'soweto': 'Samba & Pagode', 'os travessos': 'Samba & Pagode',
    'mumuzinho': 'Samba & Pagode', 'suel': 'Samba & Pagode', 'diogo nogueira': 'Samba & Pagode',

    // Indie & Alternativo
    'arctic monkeys': 'Indie & Alternativo', 'the strokes': 'Indie & Alternativo',
    'radiohead': 'Indie & Alternativo', 'tame impala': 'Indie & Alternativo',
    'the neighbourhood': 'Indie & Alternativo', 'gorillaz': 'Indie & Alternativo',
    'lana del rey': 'Indie & Alternativo', 'foster the people': 'Indie & Alternativo',
    'twenty one pilots': 'Indie & Alternativo', 'the 1975': 'Indie & Alternativo',
    'florence + the machine': 'Indie & Alternativo', 'lorde': 'Indie & Alternativo',
    'mitski': 'Indie & Alternativo', 'phoebe bridgers': 'Indie & Alternativo',
    'mac demarco': 'Indie & Alternativo', 'clairo': 'Indie & Alternativo',
    'rex orange county': 'Indie & Alternativo', 'wallows': 'Indie & Alternativo',
    'glass animals': 'Indie & Alternativo', 'vampire weekend': 'Indie & Alternativo',
    'the black keys': 'Indie & Alternativo', 'two door cinema club': 'Indie & Alternativo',
    'cage the elephant': 'Indie & Alternativo', 'o terno': 'Indie & Alternativo', 'terno rei': 'Indie & Alternativo',

    // R&B & Soul
    'the weeknd': 'R&B & Soul', 'beyonce': 'R&B & Soul', 'beyoncé': 'R&B & Soul',
    'sza': 'R&B & Soul', 'frank ocean': 'R&B & Soul', 'alicia keys': 'R&B & Soul',
    'stevie wonder': 'R&B & Soul', 'marvin gaye': 'R&B & Soul', 'usher': 'R&B & Soul',
    'chris brown': 'R&B & Soul', 'daniel caesar': 'R&B & Soul', 'giveon': 'R&B & Soul',
    'h.e.r.': 'R&B & Soul', 'khalid': 'R&B & Soul', 'summer walker': 'R&B & Soul',
    'amy winehouse': 'R&B & Soul', 'silk sonic': 'R&B & Soul',

    // Forró & Piseiro
    'luiz gonzaga': 'Forró & Piseiro', 'dominguinhos': 'Forró & Piseiro',
    'wesley safadao': 'Forró & Piseiro', 'wesley safadão': 'Forró & Piseiro',
    'joao gomes': 'Forró & Piseiro', 'joão gomes': 'Forró & Piseiro',
    'tarcisio do acordeon': 'Forró & Piseiro', 'tarcísio do acordeon': 'Forró & Piseiro',
    'nattan': 'Forró & Piseiro', 'mari fernandez': 'Forró & Piseiro',
    'calcinha preta': 'Forró & Piseiro', 'mastruz com leite': 'Forró & Piseiro',
    'avioes do forro': 'Forró & Piseiro', 'aviões do forró': 'Forró & Piseiro',
    'xand aviao': 'Forró & Piseiro', 'limao com mel': 'Forró & Piseiro',
    'magnificos': 'Forró & Piseiro', 'saia rodada': 'Forró & Piseiro',
    'baroes da pisadinha': 'Forró & Piseiro', 'os barões da pisadinha': 'Forró & Piseiro',
    'ze vaqueiro': 'Forró & Piseiro', 'zé vaqueiro': 'Forró & Piseiro',
    'vitor fernandes': 'Forró & Piseiro', 'falamansa': 'Forró & Piseiro',

    // Lo-Fi & Chill
    'lofi girl': 'Lo-Fi & Chill', 'chilledcow': 'Lo-Fi & Chill', 'kudasai': 'Lo-Fi & Chill',
    'potsu': 'Lo-Fi & Chill', 'idealism': 'Lo-Fi & Chill', 'jinsang': 'Lo-Fi & Chill',
    'tomppabeats': 'Lo-Fi & Chill', 'saib': 'Lo-Fi & Chill', 'kupla': 'Lo-Fi & Chill',

    // Jazz & Blues
    'miles davis': 'Jazz & Blues', 'john coltrane': 'Jazz & Blues', 'louis armstrong': 'Jazz & Blues',
    'b.b. king': 'Jazz & Blues', 'bb king': 'Jazz & Blues', 'ella fitzgerald': 'Jazz & Blues',
    'chet baker': 'Jazz & Blues', 'nina simone': 'Jazz & Blues', 'billie holiday': 'Jazz & Blues',
    'eric clapton': 'Jazz & Blues', 'stevie ray vaughan': 'Jazz & Blues', 'norah jones': 'Jazz & Blues',

    // Clássica
    'beethoven': 'Clássica & Instrumental', 'ludwig van beethoven': 'Clássica & Instrumental',
    'mozart': 'Clássica & Instrumental', 'wolfgang amadeus mozart': 'Clássica & Instrumental',
    'bach': 'Clássica & Instrumental', 'johann sebastian bach': 'Clássica & Instrumental',
    'chopin': 'Clássica & Instrumental', 'vivaldi': 'Clássica & Instrumental',
    'tchaikovsky': 'Clássica & Instrumental', 'hans zimmer': 'Clássica & Instrumental',
    'john williams': 'Clássica & Instrumental', 'ludovico einaudi': 'Clássica & Instrumental',
    'ennio morricone': 'Clássica & Instrumental',

    // Reggae
    'bob marley': 'Reggae', 'bob marley & the wailers': 'Reggae', 'peter tosh': 'Reggae',
    'jimmy cliff': 'Reggae', 'ub40': 'Reggae', 'natiruts': 'Reggae', 'maneva': 'Reggae',
    'planta e raiz': 'Reggae', 'planta & raiz': 'Reggae', 'armandinho': 'Reggae',
    'ponto de equilibrio': 'Reggae', 'ponto de equilíbrio': 'Reggae', 'tribo de jah': 'Reggae',
    'maskavo': 'Reggae', 'chimarruts': 'Reggae', 'cidade negra': 'Reggae', 'edson gomes': 'Reggae',
    'soja': 'Reggae', 'rebelution': 'Reggae', 'stick figure': 'Reggae',

    // Gospel
    'fernandinho': 'Gospel & Cristã', 'gabriela rocha': 'Gospel & Cristã', 'aline barros': 'Gospel & Cristã',
    'diante do trono': 'Gospel & Cristã', 'isadora pompeo': 'Gospel & Cristã', 'kemuel': 'Gospel & Cristã',
    'morada': 'Gospel & Cristã', 'casa worship': 'Gospel & Cristã', 'preto no branco': 'Gospel & Cristã',
    'anderson freire': 'Gospel & Cristã', 'bruna karla': 'Gospel & Cristã', 'thalles roberto': 'Gospel & Cristã',
    'hillsong': 'Gospel & Cristã', 'elevation worship': 'Gospel & Cristã', 'bethel music': 'Gospel & Cristã'
};

function normalizeString(str) {
    if (!str) return '';
    return str.toString()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/&/g, ' e ')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// Build pre-normalized lookup tables for ultra-fast and robust matching
const NORMALIZED_RAW_TAG_MAP = {};
for (const [k, v] of Object.entries(RAW_TAG_MAP)) {
    NORMALIZED_RAW_TAG_MAP[normalizeString(k)] = v;
}

const NORMALIZED_ARTIST_MAP = {};
for (const [k, v] of Object.entries(ARTIST_GENRE_MAP)) {
    NORMALIZED_ARTIST_MAP[normalizeString(k)] = v;
}

/**
 * Classifies a track into a canonical genre/style.
 * @param {Object} track - Object containing title, artist, album, file_path, genre.
 * @returns {String} Canonical Genre Name (e.g. "Rock", "Sertanejo", "Pop", etc.)
 */
function identifyGenre(track) {
    if (!track) return 'Outros';

    const rawGenre = (track.genre || '').trim();
    const rawArtist = (track.artist || '').trim();
    const rawTitle = (track.title || '').trim();
    const rawAlbum = (track.album || '').trim();
    const rawPath = (track.file_path || '').trim();

    // 1. Direct match on ID3 genre tag if exists and not 'unknown'
    if (rawGenre && rawGenre.toLowerCase() !== 'unknown' && rawGenre.toLowerCase() !== 'desconhecido') {
        const parts = rawGenre.split(/[,/;\&]/).map(g => normalizeString(g)).filter(Boolean);
        for (const p of parts) {
            if (NORMALIZED_RAW_TAG_MAP[p]) return NORMALIZED_RAW_TAG_MAP[p];
            // Check partial matches on known keys
            for (const [k, canonical] of Object.entries(NORMALIZED_RAW_TAG_MAP)) {
                if (p.includes(k) || k.includes(p)) return canonical;
            }
        }
    }

    // 2. High-precision Artist lookup
    const normArtist = normalizeString(rawArtist);
    if (normArtist && normArtist !== 'artista desconhecido' && normArtist !== 'spotcry') {
        if (NORMALIZED_ARTIST_MAP[normArtist]) return NORMALIZED_ARTIST_MAP[normArtist];
        // Check substring containment in artist dictionary
        for (const [knownArtist, canonical] of Object.entries(NORMALIZED_ARTIST_MAP)) {
            if (normArtist.includes(knownArtist) || (knownArtist.length > 4 && knownArtist.includes(normArtist))) {
                return canonical;
            }
        }
    }

    // 3. Keyword analysis in Filepath, Album, and Title
    const combinedContext = normalizeString(`${rawPath} ${rawAlbum} ${rawTitle}`);

    if (/\b(phonk|mandelao|mandela|funk|brega|eletrobrega|baile)\b/.test(combinedContext)) return 'Funk & Brega';
    if (/\b(sertanejo|modao|sofre|sofrência|agro|pantanal|boiadeira)\b/.test(combinedContext)) return 'Sertanejo';
    if (/\b(trap|rap|hiphop|hip hop|freestyle|cypher|drill|flow|beatmaker)\b/.test(combinedContext)) return 'Hip-Hop & Rap';
    if (/\b(pagode|samba|cavaquinho|partido alto|roda de samba)\b/.test(combinedContext)) return 'Samba & Pagode';
    if (/\b(forro|piseiro|pisadinha|vaquejada|xote|baiao)\b/.test(combinedContext)) return 'Forró & Piseiro';
    if (/\b(heavy metal|metalcore|death metal|thrash|deathcore|black metal|riff)\b/.test(combinedContext)) return 'Metal & Hardcore';
    if (/\b(lo fi|lofi|chillhop|relaxing study|chill beats)\b/.test(combinedContext)) return 'Lo-Fi & Chill';
    if (/\b(synthwave|cyberpunk|techno|trance|psytrance|dubstep|club mix|extended mix|edm)\b/.test(combinedContext)) return 'Eletrônica & EDM';
    if (/\b(bossa nova|mpb|tropicalia)\b/.test(combinedContext)) return 'MPB & Bossa Nova';
    if (/\b(orchestra|orquestra|soundtrack|trilha sonora|piano solo|symphony|sinfonia)\b/.test(combinedContext)) return 'Clássica & Instrumental';
    if (/\b(reggae|rastafari|roots)\b/.test(combinedContext)) return 'Reggae';
    if (/\b(gospel|louvor|adoracao|worship|crista)\b/.test(combinedContext)) return 'Gospel & Cristã';
    if (/\b(jazz|blues|saxophone|sax)\b/.test(combinedContext)) return 'Jazz & Blues';
    if (/\b(rock|grunge|punk|indie|acoustic)\b/.test(combinedContext)) return 'Rock';

    // Fallback: If raw genre was a valid non-empty string, capitalize it, else 'Outros'
    if (rawGenre && rawGenre.length > 2) {
        return rawGenre.charAt(0).toUpperCase() + rawGenre.slice(1);
    }

    return 'Outros';
}

function getGenreDefinition(genreName) {
    return GENRE_DEFINITIONS[genreName] || {
        name: genreName,
        icon: '🎵',
        color: '#6B7280',
        gradient: 'linear-gradient(135deg, #6B7280, #374151)',
        banner: 'linear-gradient(180deg, #6B7280 0%, rgba(18, 18, 18, 0.92) 100%)',
        desc: `Músicas de ${genreName} na sua biblioteca`
    };
}

module.exports = {
    identifyGenre,
    getGenreDefinition,
    GENRE_DEFINITIONS
};
