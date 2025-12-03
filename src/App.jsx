import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Menu, X, Star, Play, Loader, Monitor, User, Video, Film, Tag, 
  LayoutGrid, ChevronRight, ChevronLeft, Sparkles 
} from 'lucide-react';
import './App.css';

// --- CONFIGURATION ---
const API_KEY = "6cf39a7a760d396cc663ddd7dc70b8ba"; 
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";
const BACKDROP_BASE_URL = "https://image.tmdb.org/t/p/original";
const THEME_COLOR = "#08DB89"; 

// --- DICTIONARIES ---
const GENRES = {
  "action": 28, "adventure": 12, "animation": 16, "comedy": 35, "crime": 80,
  "documentary": 99, "drama": 18, "family": 10751, "fantasy": 14, "history": 36,
  "horror": 27, "music": 10402, "mystery": 9648, "romance": 10749, "scifi": 878,
  "sci-fi": 878, "thriller": 53, "war": 10752, "western": 37
};

const MOODS = {
  "sad": 18, "happy": 35, "funny": 35, "scary": 27, "tense": 53, "love": 10749,
  "feel-good": 35, "emotional": 18, "exciting": 28
};

const REGIONS = { 
  "bollywood": "hi", 
  "hindi": "hi", 
  "hollywood": "en", 
  "korean": "ko", 
  "japanese": "ja", 
  "french": "fr" 
};

const DECADES = {
  "80s": ["1980-01-01", "1989-12-31"],
  "90s": ["1990-01-01", "1999-12-31"],
  "2000s": ["2000-01-01", "2009-12-31"],
  "2010s": ["2010-01-01", "2019-12-31"],
  "classic": ["1950-01-01", "1979-12-31"]
};

// Keywords mapping to IDs
const KEYWORDS = {
  "mind-bending": "9840", "psychological": "9840", "plot twist": "11800", "twist": "11800",
  "cyberpunk": "4563", "dystopian": "4563", "space": "3801", "alien": "9951", 
  "gangster": "10478", "mafia": "10478", "whodunit": "10714", "serial killer": "7025", 
  "noir": "4565", "time travel": "4379", "superhero": "9715", "vampire": "3133", 
  "zombie": "12377", "heist": "10051", "cult": "9799", "surreal": "10714",
  "revenge": "9748", "martial arts": "1701", "sports": "6075", "politics": "5923"
};

// NEW: loose emotion synonyms → genre IDs
const EMOTION_SYNONYMS = {
  "jolly": [35, 10751],
  "joyful": [35, 10751],
  "cheerful": [35, 10751],
  "lighthearted": [35, 10751],
  "uplifting": [35, 18],
  "heartwarming": [35, 18, 10749],
  "envy": [18, 53],
  "jealous": [18, 53],
  "jealousy": [18, 53],
  "lonely": [18],
  "loneliness": [18],
  "nostalgic": [18, 10749],
  "nostalgia": [18, 10749],
  "rage": [28, 53],
  "furious": [28, 53],
  "calm": [99],
};

const SUGGESTIONS = [
  "Plot Twist", "Underrated Bollywood", "90s Crime Thriller",
  "Psychological Horror", "Feel-good Comedy", "Time Travel"
];

const TAG_POOL = [
  "Cult Classics", "Cyberpunk", "Award Winning", "Indie Gems", "Plot Twist", 
  "True Story", "Visually Stunning", "Dystopian", "Time Travel", "Noir",
  "Space Opera", "Martial Arts", "Coming of Age", "Revenge", "Whodunit"
];

// --- HELPER FUNCTIONS (search quality) ---

// Normalize titles: remove spaces/punct, lowercase
const normalizeTitle = (s = "") => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// Score by rating + vote count so popular & good rated bubble up
const qualitySort = (movies = []) => {
  return [...movies].sort((a, b) => {
    const va = a.vote_average || 0;
    const vb = b.vote_average || 0;
    const ca = a.vote_count || 0;
    const cb = b.vote_count || 0;
    const qa = va * Math.log10(ca + 1);
    const qb = vb * Math.log10(cb + 1);
    return qb - qa;
  });
};

// Prefer movies with decent votes & rating; fallback gracefully
const qualityFilter = (movies = [], minVotes = 80, minRating = 6.3) => {
  const filtered = movies.filter(
    (m) => (m.vote_count || 0) >= minVotes && (m.vote_average || 0) >= minRating
  );
  if (filtered.length > 0) return qualitySort(filtered);
  return qualitySort(movies);
};

export default function TheGreatMovieVault() {
  // --- STATE ---
  const [query, setQuery] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const [history, setHistory] = useState([]);
  const [viewMode, setViewMode] = useState('home');
  
  // Queue System
  const [movieQueue, setMovieQueue] = useState([]); 
  const [queueIndex, setQueueIndex] = useState(0);
  const [queueContext, setQueueContext] = useState("");
  
  const [currentMovie, setCurrentMovie] = useState(null);
  const [collectionData, setCollectionData] = useState({ title: "", movies: [] });
  const [credits, setCredits] = useState(null);
  const [providers, setProviders] = useState(null);
  const [alternatives, setAlternatives] = useState([]); 
  const [backgroundPosters, setBackgroundPosters] = useState([]);
  const [displayTags, setDisplayTags] = useState([]);
  const [fetching, setFetching] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [trailerKey, setTrailerKey] = useState(null);
  const chatEndRef = useRef(null);

  // --- INIT WALLPAPER ---
  useEffect(() => {
    const fetchBackgrounds = async () => {
      try {
        const res = await fetch(`https://api.themoviedb.org/3/movie/top_rated?api_key=${API_KEY}&page=1`);
        const data = await res.json();
        if (data.results) setBackgroundPosters(data.results.slice(0, 12));
      } catch(e) {}
    };
    fetchBackgrounds();
  }, []);

  // NEW: Load history from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('vault_history');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setHistory(parsed);
      }
    } catch (e) {
      console.error("Failed to load history", e);
    }
  }, []);

  // NEW: Persist history to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('vault_history', JSON.stringify(history));
    } catch (e) {
      console.error("Failed to save history", e);
    }
  }, [history]);

  // --- AUTOCOMPLETE ENGINE ---
  useEffect(() => {
    if (!isTyping || query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      const lower = query.toLowerCase();
      let matches = [];

      // 1. Concepts (Local)
      const allConcepts = { ...GENRES, ...MOODS, ...KEYWORDS, ...DECADES, ...EMOTION_SYNONYMS };
      Object.keys(allConcepts).forEach(key => {
        if (key.includes(lower)) {
          matches.push({ type: 'topic', label: key });
        }
      });

      // 2. Movies (API)
      try {
        const res = await fetch(
          `https://api.themoviedb.org/3/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(query)}&page=1`
        );
        const data = await res.json();
        if (data.results) {
          const titles = data.results
            .filter(m => m.poster_path && m.vote_count > 10)
            .slice(0, 3)
            .map(m => ({ type: 'movie', label: m.title, id: m.id }));
          matches = [...matches, ...titles];
        }
      } catch (e) {}

      setSuggestions(matches.slice(0, 6));
      setShowSuggestions(true);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, isTyping]);

  const shuffleTags = () => {
    const shuffled = [...TAG_POOL].sort(() => 0.5 - Math.random());
    setDisplayTags(shuffled.slice(0, 8));
  };

  // --- LOAD MOVIE PAGE ---
  const loadMoviePage = async (movie) => {
    if (!movie) return;
    setFetching(true);
    setTrailerKey(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    shuffleTags();

    try {
      // Fetch Details
      const creditsRes = await fetch(
        `https://api.themoviedb.org/3/movie/${movie.id}/credits?api_key=${API_KEY}`
      );
      const creditsData = await creditsRes.json();
      const director = creditsData.crew?.find(m => m.job === "Director");
      const topCast = creditsData.cast?.slice(0, 4) || [];
      setCredits({ director: director ? director.name : "Unknown", cast: topCast });

      const providerRes = await fetch(
        `https://api.themoviedb.org/3/movie/${movie.id}/watch/providers?api_key=${API_KEY}`
      );
      const providerData = await providerRes.json();
      const regionData = providerData.results?.IN || providerData.results?.US;
      setProviders(regionData ? regionData.flatrate || regionData.buy : null);

      const videosRes = await fetch(
        `https://api.themoviedb.org/3/movie/${movie.id}/videos?api_key=${API_KEY}`
      );
      const videosData = await videosRes.json();
      const trailer = videosData.results?.find(
        v => (v.type === "Trailer" || v.type === "Teaser") && v.site === "YouTube"
      );
      setTrailerKey(trailer ? trailer.key : null);

      const recRes = await fetch(
        `https://api.themoviedb.org/3/movie/${movie.id}/recommendations?api_key=${API_KEY}&page=1`
      );
      const recData = await recRes.json();
      const filteredAlts = qualityFilter(recData.results || [], 50, 6.0); // NEW: quality
      setAlternatives(filteredAlts.slice(0, 10));

      setCurrentMovie(movie);
      setViewMode('movie');
    } catch(e) { 
      console.error(e); 
    } finally { 
      setFetching(false); 
    }
  };

  // Helper for forceful concept search
  const executeDiscoverySearch = async (tag) => {
    let params = `api_key=${API_KEY}&language=en-US&include_adult=false&page=1&sort_by=popularity.desc&vote_count.gte=200`;
    
    const lower = tag.toLowerCase();
    if (KEYWORDS[lower]) params += `&with_keywords=${KEYWORDS[lower]}`;
    if (GENRES[lower]) params += `&with_genres=${GENRES[lower]}`;

    // Also check emotion synonyms
    if (EMOTION_SYNONYMS[lower]) {
      const ids = EMOTION_SYNONYMS[lower];
      params += `&with_genres=${ids.join(',')}`;
    }
    
    const res = await fetch(`https://api.themoviedb.org/3/discover/movie?${params}`);
    const data = await res.json();
    
    if (data.results?.length > 0) {
      const filtered = qualityFilter(data.results, 80, 6.3); // NEW
      setMovieQueue(filtered);
      setQueueIndex(0);
      await loadMoviePage(filtered[0]);
      setHistory(prev => [{ query: tag, result: filtered[0].title }, ...prev]);
    }
    setFetching(false);
  };

  // --- MASTER SEARCH HANDLER ---
  const handleSearch = async (overrideQuery = null, type = null) => {
    const searchText = overrideQuery || query;
    if (!searchText) return;
    
    setIsTyping(false);
    setShowSuggestions(false);
    
    setFetching(true);
    setSidebarOpen(false);
    setQuery(searchText);
    setCurrentMovie(null);
    
    setMovieQueue([]);
    setQueueIndex(0);
    setQueueContext(searchText);

    if (type === 'topic') {
      await executeDiscoverySearch(searchText);
      return;
    }

    const lowerQuery = searchText.toLowerCase();
    
    // --- PARSE INTENT ---
    let genreIds = new Set();
    let keywordIds = new Set();
    let selectedLang = null;
    let dateRange = null;

    Object.keys(DECADES).forEach(k => { 
      if (lowerQuery.includes(k)) dateRange = DECADES[k]; 
    });

    Object.keys(GENRES).forEach(k => { 
      if (lowerQuery.includes(k)) genreIds.add(GENRES[k]); 
    });

    Object.keys(MOODS).forEach(k => { 
      if (lowerQuery.includes(k)) genreIds.add(MOODS[k]); 
    });

    Object.keys(KEYWORDS).forEach(k => { 
      if (lowerQuery.includes(k)) keywordIds.add(KEYWORDS[k]); 
    });

    Object.keys(REGIONS).forEach(k => { 
      if (lowerQuery.includes(k)) selectedLang = REGIONS[k]; 
    });

    // NEW: check per-word emotion synonyms
    const words = lowerQuery.split(/\W+/).filter(Boolean);
    words.forEach(w => {
      if (EMOTION_SYNONYMS[w]) {
        EMOTION_SYNONYMS[w].forEach(id => genreIds.add(id));
      }
    });

    const selectedGenres = Array.from(genreIds);
    const selectedKeywords = Array.from(keywordIds);

    try {
      // 1. COMPLEX DISCOVERY (Concepts/Vibes)
      if (selectedGenres.length > 0 || selectedLang || dateRange || selectedKeywords.length > 0) {
        let params = `api_key=${API_KEY}&language=en-US&include_adult=false&page=1`;
        if (dateRange) params += `&primary_release_date.gte=${dateRange[0]}&primary_release_date.lte=${dateRange[1]}`;
        if (selectedGenres.length > 0) params += `&with_genres=${selectedGenres.join(',')}`;
        if (selectedKeywords.length > 0) params += `&with_keywords=${selectedKeywords.join('|')}`;
        if (selectedLang) params += `&with_original_language=${selectedLang}`;
        
        params += (dateRange || selectedKeywords.length > 0) 
          ? `&vote_count.gte=300&sort_by=vote_average.desc` 
          : `&vote_count.gte=200&sort_by=popularity.desc`;

        const res = await fetch(`https://api.themoviedb.org/3/discover/movie?${params}`);
        const data = await res.json();

        if (data.results?.length > 0) {
          const filtered = qualityFilter(data.results, 120, 6.5); // NEW
          setMovieQueue(filtered);
          setQueueIndex(0);
          await loadMoviePage(filtered[0]);
          setHistory(prev => [{ query: searchText, result: filtered[0].title }, ...prev]);
          setFetching(false);
          return;
        }
      }

      // 2. PERSON SEARCH
      const personRes = await fetch(
        `https://api.themoviedb.org/3/search/person?api_key=${API_KEY}&query=${encodeURIComponent(searchText)}`
      );
      const personData = await personRes.json();

      if (personData.results && personData.results.length > 0) {
        const person = personData.results[0];
        const creditsRes = await fetch(
          `https://api.themoviedb.org/3/person/${person.id}/movie_credits?api_key=${API_KEY}`
        );
        const creditsData = await creditsRes.json();
        
        const cleanList = [...(creditsData.cast || []), ...(creditsData.crew || [])]
          .filter(m => m.poster_path && m.vote_count > 50)
          .filter((v,i,a)=>a.findIndex(v2=>(v2.id===v.id))===i)
          .sort((a, b) => b.popularity - a.popularity);

        if (cleanList.length > 0) {
          const filtered = qualityFilter(cleanList, 60, 6.0); // NEW
          setCollectionData({ title: `Filmography: ${person.name}`, movies: filtered });
          setMovieQueue(filtered);
          setQueueIndex(0);
          setViewMode('collection'); 
          setHistory(prev => [{ query: searchText, result: `Collection: ${person.name}` }, ...prev]);
          setFetching(false);
          return;
        }
      }

      // 3. TITLE SEARCH (IMPROVED)
      const titleRes = await fetch(
        `https://api.themoviedb.org/3/search/movie?api_key=${API_KEY}&language=en-US&query=${encodeURIComponent(searchText)}&page=1&include_adult=false`
      );
      const titleData = await titleRes.json();
      
      if (titleData.results?.length > 0) {
        const qNorm = normalizeTitle(searchText);
        const allResults = titleData.results.filter(m => m.poster_path);

        const strongMatches = allResults.filter(m => {
          const tNorm = normalizeTitle(m.title);
          return (
            tNorm === qNorm ||
            tNorm.startsWith(qNorm) ||
            qNorm.startsWith(tNorm)
          );
        });

        const bestPool = strongMatches.length > 0 ? strongMatches : allResults;
        const filteredPool = qualityFilter(bestPool, 50, 6.0);

        // If multiple strong matches (ABCD-type scenario) → collection view
        if (filteredPool.length > 1 && strongMatches.length > 1) {
          setCollectionData({ 
            title: `Matches for "${searchText}"`, 
            movies: filteredPool 
          });
          setMovieQueue(filteredPool);
          setQueueIndex(0);
          setViewMode('collection');
          setHistory(prev => [{ query: searchText, result: `Matches: ${searchText}` }, ...prev]);
          setFetching(false);
          return;
        }

        // Otherwise, use top match + recommendations
        const firstMovie = filteredPool[0] || allResults[0];
        const recRes = await fetch(
          `https://api.themoviedb.org/3/movie/${firstMovie.id}/recommendations?api_key=${API_KEY}&page=1`
        );
        const recData = await recRes.json();

        const recPool = [firstMovie, ...(recData.results || [])];
        const filteredQueue = qualityFilter(recPool, 60, 6.0);
        
        setMovieQueue(filteredQueue);
        setQueueIndex(0);
        await loadMoviePage(firstMovie);
        setHistory(prev => [{ query: searchText, result: firstMovie.title }, ...prev]);
        return;
      }

    } catch (e) { 
      console.error(e); 
    } finally { 
      setFetching(false); 
    }
  };

  // --- NEXT / PREVIOUS BUTTONS ---
  const handleNext = () => {
    if (!movieQueue || movieQueue.length === 0 || queueIndex >= movieQueue.length - 1) {
      if (currentMovie) { 
        handleGridClick(currentMovie); 
      } else { 
        handleSearch("Underrated Masterpiece"); 
      }
      return;
    }
    const nextIndex = queueIndex + 1;
    setQueueIndex(nextIndex);
    loadMoviePage(movieQueue[nextIndex]);
  };

  const handlePrevious = () => {
    if (!movieQueue || movieQueue.length === 0 || queueIndex <= 0) return;
    const prevIndex = queueIndex - 1;
    setQueueIndex(prevIndex);
    loadMoviePage(movieQueue[prevIndex]);
  };

  const handleCollectionClick = (movie, index) => {
    setQueueIndex(index);
    loadMoviePage(movie);
  };

  const handleGridClick = async (movie) => {
    setFetching(true);
    setTrailerKey(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    try {
      const recRes = await fetch(
        `https://api.themoviedb.org/3/movie/${movie.id}/recommendations?api_key=${API_KEY}&page=1`
      );
      const recData = await recRes.json();
      const recPool = [movie, ...(recData.results || [])];
      const filteredQueue = qualityFilter(recPool, 60, 6.0); // NEW
      setMovieQueue(filteredQueue);
      setQueueIndex(0);
      setQueueContext(`Similar to: ${movie.title}`);
      await loadMoviePage(movie);
    } catch(e) {
      console.error(e);
    }
  };

  return (
    <div className="h-screen w-screen flex bg-[#050505] text-white overflow-hidden relative font-sans">
      
      {/* WALLPAPER */}
      {viewMode === 'home' && (
        <div className="absolute inset-0 overflow-hidden z-0 opacity-20 pointer-events-none">
          <div className="grid grid-cols-3 md:grid-cols-4 gap-8 p-4">
            {backgroundPosters.map((movie, i) => (
              <div 
                key={movie.id} 
                className="floating-poster" 
                style={{ animationDelay: `${i * 1.5}s`, marginTop: `${(i % 3) * 40}px` }}
              >
                <img 
                  src={`${IMAGE_BASE_URL}${movie.poster_path}`} 
                  alt="" 
                  className="rounded-xl grayscale hover:grayscale-0 transition-all duration-1000" 
                />
              </div>
            ))}
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/90 to-transparent"></div>
        </div>
      )}

      {/* SIDEBAR */}
      <div className={`fixed inset-y-0 left-0 bg-black/90 backdrop-blur-xl border-r border-white/10 w-72 transform transition-transform duration-300 z-50 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex items-center justify-between border-b border-white/10">
          <span className="font-bold tracking-widest" style={{ color: THEME_COLOR }}>VAULT LOGS</span>
          <button onClick={() => setSidebarOpen(false)}><X size={20} /></button>
        </div>
        <div className="p-4 overflow-y-auto h-full">
          {history.map((h, i) => (
            <div 
              key={i} 
              className="p-3 mb-2 rounded-lg bg-white/5 border border-white/5 hover:border-[#08DB89] cursor-pointer transition-colors" 
              onClick={() => handleSearch(h.query)}
            >
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Log #{history.length - i}</div>
              <div className="text-sm font-bold text-gray-200 truncate">{h.result}</div>
            </div>
          ))}
        </div>
      </div>

      {/* MAIN AREA */}
      <div className="flex-1 flex flex-col relative z-10 h-full">
        <header className="p-6 flex items-center justify-between relative z-30">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-full hover:bg-white/10 transition-colors">
              <Menu size={24} />
            </button>
            <h1 
              className="text-2xl md:text-3xl font-bold tracking-tighter cursor-pointer" 
              onClick={() => { 
                setViewMode('home'); 
                setCurrentMovie(null); 
                setQuery(""); 
              }}
            >
              THE GREAT MOVIE <span style={{ color: THEME_COLOR }}>VAULT</span>
            </h1>
          </div>

          {viewMode === 'movie' && (
            <div className="flex items-center gap-3">
              {queueIndex > 0 && (
                <button 
                  onClick={handlePrevious} 
                  className="group flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:border-[#08DB89] transition-all hover:bg-[#08DB89]/10"
                >
                  <ChevronLeft size={18} className="text-[#08DB89]" />
                  <span className="text-xs font-bold tracking-widest text-gray-300 group-hover:text-[#08DB89]">
                    PREVIOUS
                  </span>
                </button>
              )}
              <button 
                onClick={handleNext} 
                className="group flex items-center gap-2 px-5 py-2 rounded-full bg-white/5 border border-white/10 hover:border-[#08DB89] transition-all hover:bg-[#08DB89]/10"
              >
                <div className="flex flex-col items-end">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                    {queueContext.substring(0, 15)}...
                  </span>
                  <span className="text-xs font-bold tracking-widest text-gray-300 group-hover:text-[#08DB89]">
                    NEXT ARCHIVE
                  </span>
                </div>
                <ChevronRight size={20} className="text-[#08DB89]" />
              </button>
            </div>
          )}
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-10 flex flex-col items-center">
          {viewMode === 'home' && !fetching && (
            <div className="flex flex-col items-center justify-center h-[40vh] text-center animate-in fade-in zoom-in duration-700 mt-20">
              <div className="mb-6 p-6 rounded-full bg-white/5 border border-white/10 shadow-[0_0_30px_rgba(8,219,137,0.1)]">
                <Video size={48} style={{ color: THEME_COLOR }} />
              </div>
              <h2 className="text-3xl font-light text-gray-300">Access the Archives</h2>
              <p className="text-gray-500 mt-2 max-w-md">
                Try "Plot Twist", "90s Crime", or "Shah Rukh Khan".
              </p>
            </div>
          )}

          {fetching && (
            <div className="flex flex-col items-center justify-center h-[50vh]">
              <Loader size={40} className="animate-spin mb-4" style={{ color: THEME_COLOR }} />
              <span className="text-xs tracking-[0.3em] text-gray-500">DECRYPTING...</span>
            </div>
          )}

          {viewMode === 'collection' && !fetching && (
            <div className="w-full max-w-6xl animate-in slide-in-from-bottom-10 duration-700 pb-20">
              <div className="flex items-center gap-4 mb-8 border-b border-white/10 pb-6">
                <LayoutGrid size={32} style={{ color: THEME_COLOR }} />
                <h2 className="text-3xl font-bold text-white">{collectionData.title}</h2>
                <span className="bg-white/10 px-3 py-1 rounded-full text-xs text-gray-400">
                  {collectionData.movies.length} Archives
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                {collectionData.movies.map((m, index) => (
                  <div 
                    key={m.id} 
                    onClick={() => handleCollectionClick(m, index)} 
                    className="group cursor-pointer"
                  >
                    <div className="relative aspect-[2/3] rounded-xl overflow-hidden mb-3 border border-white/5 group-hover:border-[#08DB89] transition-all">
                      {m.poster_path ? (
                        <img 
                          src={`${IMAGE_BASE_URL}${m.poster_path}`} 
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                          alt="" 
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-800"/>
                      )}
                    </div>
                    <h4 className="text-sm font-bold text-gray-300 group-hover:text-[#08DB89] truncate">
                      {m.title}
                    </h4>
                    <p className="text-xs text-gray-600">
                      {m.release_date?.split('-')[0]}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {viewMode === 'movie' && currentMovie && !fetching && (
            <div className="w-full max-w-6xl animate-in slide-in-from-bottom-10 duration-700 pb-20">
              <div className="fixed inset-0 z-[-1]">
                <img 
                  src={`${BACKDROP_BASE_URL}${currentMovie.backdrop_path}`} 
                  className="w-full h-full object-cover opacity-10 blur-3xl" 
                  alt="" 
                />
              </div>
              <div className="flex flex-col lg:flex-row gap-12 mb-20">
                <div className="w-full lg:w-80 shrink-0 flex flex-col gap-6">
                  <img 
                    src={`${IMAGE_BASE_URL}${currentMovie.poster_path}`} 
                    className="w-full rounded-2xl shadow-[0_0_40px_rgba(8,219,137,0.15)] border border-white/10" 
                    alt="Poster" 
                  />
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/10 backdrop-blur-md">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Monitor size={14} /> Streaming On (IN)
                    </h3>
                    <div className="flex flex-wrap gap-3">
                      {providers && providers.length > 0 ? (
                        providers.map((p) => (
                          <div 
                            key={p.provider_id} 
                            className="flex items-center gap-2 bg-black/40 px-3 py-2 rounded-lg border border-white/5"
                          >
                            {p.logo_path && (
                              <img 
                                src={`${IMAGE_BASE_URL}${p.logo_path}`} 
                                className="w-6 h-6 rounded-full" 
                                alt="" 
                              />
                            )}
                            <span className="text-xs font-semibold">{p.provider_name}</span>
                          </div>
                        ))
                      ) : (
                        <span className="text-xs text-gray-500">
                          No streaming data available.
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex-1 space-y-8">
                  <div>
                    <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-4">
                      {currentMovie.title}
                    </h1>
                    <div className="flex items-center gap-4 text-sm font-mono text-[#08DB89]">
                      <span className="flex items-center gap-1 bg-[#08DB89]/10 px-3 py-1 rounded-full border border-[#08DB89]/20">
                        <Star size={14} fill="#08DB89" /> {currentMovie.vote_average?.toFixed(1)}
                      </span>
                      <span>{currentMovie.release_date?.split("-")[0]}</span>
                      <span 
                        onClick={() => handleSearch(credits?.director)} 
                        className="cursor-pointer hover:text-white hover:underline underline-offset-4 decoration-[#08DB89]"
                      >
                        {credits?.director} (Dir.)
                      </span>
                    </div>
                  </div>

                  <p 
                    className="text-xl text-gray-300 font-light leading-relaxed border-l-2 pl-6" 
                    style={{ borderColor: THEME_COLOR }}
                  >
                    {currentMovie.overview}
                  </p>

                  {credits?.cast && (
                    <div>
                      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">
                        Starring Cast
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {credits.cast.map(actor => (
                          <div 
                            key={actor.id} 
                            onClick={() => handleSearch(actor.name)} 
                            className="flex items-center gap-3 bg-white/5 p-2 rounded-xl cursor-pointer hover:bg-white/10 hover:border-[#08DB89]/50 border border-transparent transition-all group"
                          >
                            {actor.profile_path ? (
                              <img 
                                src={`${IMAGE_BASE_URL}${actor.profile_path}`} 
                                className="w-10 h-10 rounded-full object-cover group-hover:scale-110 transition-transform" 
                                alt="" 
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                                <User size={16}/>
                              </div>
                            )}
                            <div>
                              <div className="text-sm font-bold text-gray-200 leading-none group-hover:text-[#08DB89] transition-colors">
                                {actor.name}
                              </div>
                              <div className="text-[10px] text-gray-500 mt-1">{actor.character}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {trailerKey ? (
                    <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl aspect-video bg-black">
                      <iframe 
                        className="w-full h-full" 
                        src={`https://www.youtube.com/embed/${trailerKey}`} 
                        title="Trailer" 
                        allowFullScreen
                      ></iframe>
                    </div>
                  ) : (
                    <button className="px-6 py-3 rounded-full bg-white/5 hover:bg-white/10 transition-colors text-sm">
                      Trailer Unavailable
                    </button>
                  )}
                </div>
              </div>

              <div className="border-t border-white/10 pt-10 mb-20">
                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                  <Film size={18} style={{ color: THEME_COLOR }} /> Similar Vibes
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                  {alternatives.map((m) => (
                    <div 
                      key={m.id} 
                      onClick={() => handleGridClick(m)} 
                      className="group cursor-pointer"
                    >
                      <div className="relative aspect-[2/3] rounded-xl overflow-hidden mb-3 border border-white/5 group-hover:border-[#08DB89] transition-all">
                        {m.poster_path ? (
                          <img 
                            src={`${IMAGE_BASE_URL}${m.poster_path}`} 
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                            alt="" 
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-800"/>
                        )}
                      </div>
                      <h4 className="text-sm font-bold text-gray-300 group-hover:text-[#08DB89] truncate">
                        {m.title}
                      </h4>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col items-center justify-center pt-10 border-t border-white/10">
                <p className="text-[10px] text-gray-500 uppercase tracking-[0.2em] mb-6">
                  Continue Exploration
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  {displayTags.map((tag, i) => (
                    <button 
                      key={i} 
                      onClick={() => handleSearch(tag)} 
                      className="flex items-center gap-2 px-5 py-2 rounded-full bg-black border border-white/10 text-gray-400 hover:text-[#08DB89] hover:border-[#08DB89] transition-all text-xs font-bold animate-in fade-in zoom-in duration-500" 
                      style={{ animationDelay: `${i * 0.1}s` }}
                    >
                      <Tag size={12} /> {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} className="h-32" />
        </div>

        {/* INPUT AREA & AUTOCOMPLETE */}
        <div className="p-4 md:p-6 w-full max-w-4xl mx-auto relative z-20">
          
          {/* HOME SUGGESTIONS */}
          {viewMode === 'home' && !showSuggestions && (
            <div className="flex items-center justify-center gap-3 flex-wrap mb-6 animate-in fade-in slide-in-from-bottom-4">
              {SUGGESTIONS.map((s, i) => (
                <button 
                  key={i} 
                  onClick={() => handleSearch(s)} 
                  className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-xs text-gray-400 hover:bg-[#08DB89]/10 hover:text-[#08DB89] hover:border-[#08DB89]/30 transition-all duration-300"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* AUTOCOMPLETE DROPDOWN */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-neutral-900 border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-2">
              {suggestions.map((s, i) => (
                <div 
                  key={i}
                  onClick={() => handleSearch(s.label, s.type)}
                  className="px-6 py-3 hover:bg-white/10 cursor-pointer border-b border-white/5 flex items-center justify-between group"
                >
                  <span className="text-sm text-gray-200 group-hover:text-[#08DB89] transition-colors">
                    {s.label}
                  </span>
                  {s.type === 'topic' ? (
                    <Sparkles size={12} className="text-yellow-500" />
                  ) : (
                    <Film size={12} className="text-gray-500" />
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-[#08DB89] to-cyan-500 rounded-[2rem] opacity-30 blur group-hover:opacity-60 transition duration-1000"></div>
            <div className="relative flex items-center bg-[#0a0a0a] rounded-[2rem] p-2 pr-2 shadow-2xl border border-white/10">
              <input 
                type="text" 
                value={query}
                onChange={(e) => { setQuery(e.target.value); setIsTyping(true); }}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search movies, vibes, or typos (e.g., 'Incep', 'jolly revenge')..."
                className="flex-1 bg-transparent text-white placeholder-gray-600 px-6 py-3 outline-none text-lg"
              />
              <button 
                onClick={() => handleSearch()} 
                className="p-3 rounded-full bg-[#08DB89] hover:bg-[#06b570] text-black transition-transform hover:scale-105"
              >
                {fetching ? <Loader className="animate-spin" size={20}/> : <Search size={20} />}
              </button>
            </div>
          </div>
          {viewMode === 'home' && (
            <div className="text-center mt-4">
              <p className="text-[10px] text-gray-600 tracking-widest uppercase">
                The Great Movie Vault © 2025
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
