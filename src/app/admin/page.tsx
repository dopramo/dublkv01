'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { timeAgo, formatCurrency } from '@/lib/utils';

interface StreamServer {
  id?: string;
  name: string;             // Admin Provider Name e.g. "VOE", "Abyss", "Google Drive"
  input_type: 'embed' | 'url'; // 'embed' or 'url'
  embed_code?: string;      // Embed HTML snippet or embed link
  url?: string;             // Direct URL string
  enabled: boolean;         // Enabled/Disabled
  order?: number;           // Display order
  label?: string;           // Optional legacy label
}

interface TVEpisode {
  episode_number: number;
  title: string;
  description?: string;
  servers: StreamServer[];
}

interface TVSeason {
  season_number: number;
  name: string;
  episodes: TVEpisode[];
}

interface Movie {
  id: string;
  title: string;
  slug: string;
  tmdb_id: number;
  is_published: boolean;
  server1_url: string | null;
  server2_url: string | null;
  free_servers: any;
  vip_servers: StreamServer[] | null;
  poster_url: string | null;
  description: string | null;
  runtime: number | null;
  created_at: string;
  updated_at?: string;
  rating: number;
  release_year: number | null;
  genres: string[];
}

interface Purchase {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  status: string;
  payment_method: string;
  payment_proof_url: string | null;
  created_at: string;
  profiles?: { email: string; full_name: string };
  movies?: { id: string; title: string };
}

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string;
  is_admin: boolean;
  role?: 'user' | 'editor' | 'moderator' | 'admin';
  created_at: string;
  purchases: Purchase[];
}

type Tab = 'movies' | 'tv_series' | 'payments' | 'users' | 'add';

export default function AdminPage() {
  const { user, isAdmin, canMaintain, isLoading } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('movies');
  const [movies, setMovies] = useState<Movie[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Movie editing state
  const [editingMovie, setEditingMovie] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    free_servers: StreamServer[];
    vip_servers: StreamServer[];
    runtime: string;
    description: string;
  }>({ free_servers: [], vip_servers: [], runtime: '', description: '' });

  // TV Series Editing state
  const [editingTVSeries, setEditingTVSeries] = useState<string | null>(null);
  const [tvEditForm, setTvEditForm] = useState<{
    title: string;
    description: string;
    status: 'Completed' | 'Ongoing';
    seasons: TVSeason[];
  }>({ title: '', description: '', status: 'Completed', seasons: [] });
  const [selectedSeasonIdx, setSelectedSeasonIdx] = useState(0);
  const [selectedEpisodeIdx, setSelectedEpisodeIdx] = useState(0);

  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Add media form
  const [tmdbSearch, setTmdbSearch] = useState('');
  const [tmdbResults, setTmdbResults] = useState<any[]>([]);
  const [selectedTmdb, setSelectedTmdb] = useState<any>(null);
  const [publishing, setPublishing] = useState(false);

  // Searches
  const [movieSearch, setMovieSearch] = useState('');
  const [tvSearch, setTvSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');

  // Users tab
  const [usersLoading, setUsersLoading] = useState(false);

  useEffect(() => {
    if (!isLoading && (!user || !canMaintain)) {
      router.push('/');
    }
  }, [user, canMaintain, isLoading, router]);

  // Fetch movies and payments
  useEffect(() => {
    async function fetchData() {
      if (isLoading) return;
      if (!user || !canMaintain) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const [moviesRes, paymentsRes] = await Promise.all([
          fetch('/api/admin/movies'),
          fetch('/api/payments/verify?status=pending'),
        ]);

        if (moviesRes.ok) {
          const { movies } = await moviesRes.json();
          setMovies(movies || []);
        }
        if (paymentsRes.ok) {
          const { purchases } = await paymentsRes.json();
          setPurchases(purchases || []);
        }
      } catch (err) {
        console.error('Failed to fetch admin data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [user, canMaintain, isLoading]);

  // Fetch users when users tab is opened
  useEffect(() => {
    async function fetchUsers() {
      if (isLoading) return;
      if (tab !== 'users' || users.length > 0 || !user || !canMaintain) return;
      setUsersLoading(true);
      try {
        const res = await fetch('/api/admin/users');
        if (res.ok) {
          const { users: usersData } = await res.json();
          setUsers(usersData || []);
        }
      } catch (err) {
        console.error('Failed to fetch users:', err);
      } finally {
        setUsersLoading(false);
      }
    }
    fetchUsers();
  }, [tab, users.length, user, canMaintain, isLoading]);

  // Derived lists
  const moviesList = movies.filter(m => !m.free_servers?.is_tv);
  const tvSeriesList = movies.filter(m => m.free_servers?.is_tv);

  const filteredMovies = moviesList.filter((m) =>
    m.title.toLowerCase().includes(movieSearch.toLowerCase()) ||
    m.slug.toLowerCase().includes(movieSearch.toLowerCase())
  );

  const filteredTVSeries = tvSeriesList.filter((s) =>
    s.title.toLowerCase().includes(tvSearch.toLowerCase()) ||
    s.slug.toLowerCase().includes(tvSearch.toLowerCase())
  );

  const filteredUsers = users.filter(u =>
    (u.email || '').toLowerCase().includes(userSearch.toLowerCase()) ||
    (u.full_name || '').toLowerCase().includes(userSearch.toLowerCase())
  );

  // Search TMDB
  const handleTmdbSearch = async () => {
    if (!tmdbSearch.trim()) return;
    try {
      const res = await fetch(`/api/tmdb/search?q=${encodeURIComponent(tmdbSearch)}`);
      const { results } = await res.json();
      setTmdbResults(results || []);
    } catch {
      console.error('TMDB search failed');
    }
  };

  // Add Movie or TV Series
  const handleAddMedia = async () => {
    if (!selectedTmdb) return;
    setPublishing(true);

    const isTV = selectedTmdb.media_type === 'tv' || selectedTmdb.name !== undefined;
    const rawTitle = selectedTmdb.name || selectedTmdb.title;
    const releaseDate = selectedTmdb.first_air_date || selectedTmdb.release_date;
    const releaseYear = releaseDate ? parseInt(releaseDate.split('-')[0]) : null;

    const slug = (isTV ? 'tv-' : '') + rawTitle
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      + (releaseYear ? `-${releaseYear}` : '');

    const genres = (selectedTmdb.genre_ids || []).map((id: number) => {
      const genreMap: Record<number, string> = {
        28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy',
        80: 'Crime', 99: 'Documentary', 18: 'Drama', 10751: 'Family',
        14: 'Fantasy', 36: 'History', 27: 'Horror', 10402: 'Music',
        9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi', 10770: 'TV Movie',
        53: 'Thriller', 10752: 'War', 37: 'Western', 10759: 'Action & Adventure', 10762: 'Kids', 10765: 'Sci-Fi & Fantasy'
      };
      return genreMap[id] || '';
    }).filter(Boolean);

    let freeServersPayload: any = [];

    if (isTV) {
      const defaultEpisodes: TVEpisode[] = Array.from({ length: 10 }, (_, i) => ({
        episode_number: i + 1,
        title: `Episode ${i + 1}`,
        servers: [
          { name: 'SERVER 1', input_type: 'url', url: `https://vidsrc.me/embed/tv/${selectedTmdb.id}/1/${i + 1}`, enabled: true },
          { name: 'SERVER 2', input_type: 'url', url: `https://embed.su/embed/tv/${selectedTmdb.id}/1/${i + 1}`, enabled: true },
          { name: 'SERVER 3', input_type: 'url', url: `https://2embed.org/embed/tv/${selectedTmdb.id}/1/${i + 1}`, enabled: true },
          { name: 'SERVER 4', input_type: 'url', url: `https://autoembed.co/tv/tmdb/${selectedTmdb.id}-1-${i + 1}`, enabled: true },
          { name: 'SERVER 5', input_type: 'url', url: `https://multiembed.mov/directstream.php?video_id=${selectedTmdb.id}&s=1&e=${i + 1}`, enabled: true },
          { name: 'SERVER 6', input_type: 'url', url: `https://vidlink.pro/tv/${selectedTmdb.id}/1/${i + 1}`, enabled: true },
        ]
      }));

      freeServersPayload = {
        is_tv: true,
        media_type: 'tv',
        status: 'Completed',
        seasons: [
          { season_number: 1, name: 'SEASON 1', episodes: defaultEpisodes }
        ]
      };
    }

    try {
      const res = await fetch('/api/admin/movies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tmdb_id: selectedTmdb.id,
          title: rawTitle,
          slug,
          description: selectedTmdb.overview,
          poster_url: selectedTmdb.poster_path ? `https://image.tmdb.org/t/p/w500${selectedTmdb.poster_path}` : null,
          backdrop_url: selectedTmdb.backdrop_path ? `https://image.tmdb.org/t/p/original${selectedTmdb.backdrop_path}` : null,
          genres: genres.length > 0 ? genres : ['Action', 'Animation'],
          rating: selectedTmdb.vote_average || 8.0,
          release_year: releaseYear,
          free_servers: freeServersPayload,
          vip_servers: [],
          is_published: true,
        }),
      });

      if (res.ok) {
        const { movie } = await res.json();
        setMovies((prev) => [movie, ...prev]);
        setSelectedTmdb(null);
        setTmdbSearch('');
        setTmdbResults([]);
        setTab(isTV ? 'tv_series' : 'movies');
        showToast(`${isTV ? 'TV Series' : 'Movie'} added successfully!`, 'success');
      } else {
        const { error } = await res.json();
        showToast(`Error: ${error}`, 'error');
      }
    } catch (err: any) {
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      setPublishing(false);
    }
  };

  // Toggle publish
  const togglePublish = async (movie: Movie) => {
    setActionLoading(movie.id);
    try {
      const res = await fetch('/api/admin/movies', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: movie.id, is_published: !movie.is_published }),
      });
      if (res.ok) {
        setMovies((prev) =>
          prev.map((m) => (m.id === movie.id ? { ...m, is_published: !m.is_published } : m))
        );
      }
    } finally {
      setActionLoading(null);
    }
  };

  // Start editing Movie Streams
  const startEditMovie = (movie: Movie) => {
    setEditingMovie(editingMovie === movie.id ? null : movie.id);
    
    const normalizeServer = (s: any, idx: number, defaultNamePrefix: string): StreamServer => {
      const isEmbed = s.input_type === 'embed' || (s.embed_code && !s.url);
      return {
        id: s.id || `srv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: s.name || s.label || `${defaultNamePrefix} ${idx + 1}`,
        input_type: isEmbed ? 'embed' : 'url',
        embed_code: s.embed_code || (isEmbed ? s.url || '' : ''),
        url: s.url || (!isEmbed ? s.embed_code || '' : ''),
        enabled: s.enabled !== false,
        order: idx + 1,
      };
    };

    let freeServers: StreamServer[] = [];
    if (Array.isArray(movie.free_servers) && movie.free_servers.length > 0) {
      freeServers = movie.free_servers.map((s, i) => normalizeServer(s, i, 'Server'));
    } else {
      if (movie.server1_url) freeServers.push({ id: 's1', name: 'Server 1', input_type: 'url', url: movie.server1_url, enabled: true, order: 1 });
      if (movie.server2_url) freeServers.push({ id: 's2', name: 'Server 2', input_type: 'url', url: movie.server2_url, enabled: true, order: 2 });
    }

    let vipServers: StreamServer[] = [];
    if (movie.vip_servers && movie.vip_servers.length > 0) {
      vipServers = movie.vip_servers.map((s, i) => normalizeServer(s, i, 'VIP Server'));
    }

    setEditForm({
      free_servers: freeServers,
      vip_servers: vipServers,
      runtime: movie.runtime?.toString() || '',
      description: movie.description || '',
    });
    setSaveMessage(null);
    setDeleteConfirm(null);
  };

  const updateServer = (type: 'free' | 'vip', idx: number, field: keyof StreamServer, value: any) => {
    const key = type === 'free' ? 'free_servers' : 'vip_servers';
    const servers = [...editForm[key]];
    servers[idx] = { ...servers[idx], [field]: value };
    setEditForm({ ...editForm, [key]: servers });
  };

  const addServer = (type: 'free' | 'vip', defaultProviderName?: string) => {
    const key = type === 'free' ? 'free_servers' : 'vip_servers';
    const servers = editForm[key];
    const providerName = defaultProviderName || (type === 'free' ? 'VOE' : 'Google Drive');
    const isUrlType = providerName === 'Doodstream' || providerName === 'Google Drive';

    const newServer: StreamServer = {
      id: `srv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: providerName,
      input_type: isUrlType ? 'url' : 'embed',
      embed_code: '',
      url: '',
      enabled: true,
      order: servers.length + 1,
    };
    setEditForm({ ...editForm, [key]: [...servers, newServer] });
  };

  const removeServer = (type: 'free' | 'vip', idx: number) => {
    const key = type === 'free' ? 'free_servers' : 'vip_servers';
    setEditForm({ ...editForm, [key]: editForm[key].filter((_, i) => i !== idx) });
  };

  const moveServer = (type: 'free' | 'vip', idx: number, direction: 'up' | 'down') => {
    const key = type === 'free' ? 'free_servers' : 'vip_servers';
    const servers = [...editForm[key]];
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= servers.length) return;
    [servers[idx], servers[newIdx]] = [servers[newIdx], servers[idx]];
    const reordered = servers.map((s, i) => ({ ...s, order: i + 1 }));
    setEditForm({ ...editForm, [key]: reordered });
  };

  // Start editing TV Series
  const startEditTVSeries = (series: Movie) => {
    setEditingTVSeries(series.id);
    const tvPayload = series.free_servers || {};
    const seasons: TVSeason[] = tvPayload.seasons || [
      {
        season_number: 1,
        name: 'SEASON 1',
        episodes: Array.from({ length: 10 }, (_, i) => ({
          episode_number: i + 1,
          title: `Episode ${i + 1}`,
          servers: [
            { name: 'SERVER 1', input_type: 'url', url: `https://vidsrc.me/embed/tv/${series.tmdb_id}/1/${i + 1}`, enabled: true },
            { name: 'SERVER 2', input_type: 'url', url: `https://embed.su/embed/tv/${series.tmdb_id}/1/${i + 1}`, enabled: true },
            { name: 'SERVER 3', input_type: 'url', url: `https://2embed.org/embed/tv/${series.tmdb_id}/1/${i + 1}`, enabled: true },
            { name: 'SERVER 4', input_type: 'url', url: `https://autoembed.co/tv/tmdb/${series.tmdb_id}-1-${i + 1}`, enabled: true },
            { name: 'SERVER 5', input_type: 'url', url: `https://multiembed.mov/directstream.php?video_id=${series.tmdb_id}&s=1&e=${i + 1}`, enabled: true },
            { name: 'SERVER 6', input_type: 'url', url: `https://vidlink.pro/tv/${series.tmdb_id}/1/${i + 1}`, enabled: true },
          ]
        }))
      }
    ];

    setTvEditForm({
      title: series.title,
      description: series.description || '',
      status: tvPayload.status || 'Completed',
      seasons,
    });
    setSelectedSeasonIdx(0);
    setSelectedEpisodeIdx(0);
    setSaveMessage(null);
  };

  // Save Movie Edits
  const saveMovieEdit = async (movie: Movie) => {
    setActionLoading(movie.id);
    setSaveMessage(null);
    try {
      const cleanFree = editForm.free_servers
        .filter(s => (s.embed_code && s.embed_code.trim()) || (s.url && s.url.trim()))
        .map((s, i) => ({ ...s, order: i + 1 }));

      const res = await fetch('/api/admin/movies', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: movie.id,
          free_servers: cleanFree,
          vip_servers: editForm.vip_servers,
          runtime: editForm.runtime ? parseInt(editForm.runtime) : null,
          description: editForm.description,
        }),
      });

      if (res.ok) {
        const { movie: updated } = await res.json();
        setMovies((prev) => prev.map((m) => (m.id === movie.id ? updated : m)));
        setSaveMessage('Saved successfully!');
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        const { error } = await res.json();
        showToast(`Save failed: ${error}`, 'error');
      }
    } finally {
      setActionLoading(null);
    }
  };

  // Save TV Series Edits
  const saveTVSeriesEdit = async (series: Movie) => {
    setActionLoading(series.id);
    setSaveMessage(null);
    try {
      const updatedFreeServers = {
        is_tv: true,
        media_type: 'tv',
        status: tvEditForm.status,
        seasons: tvEditForm.seasons,
      };

      const res = await fetch('/api/admin/movies', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: series.id,
          title: tvEditForm.title,
          description: tvEditForm.description,
          free_servers: updatedFreeServers,
        }),
      });

      if (res.ok) {
        const { movie: updated } = await res.json();
        setMovies((prev) => prev.map((m) => (m.id === series.id ? updated : m)));
        setEditingTVSeries(null);
        showToast('TV Series updated successfully!', 'success');
      } else {
        const { error } = await res.json();
        showToast(`Save failed: ${error}`, 'error');
      }
    } finally {
      setActionLoading(null);
    }
  };

  // Delete Movie / TV Series
  const handleDeleteItem = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch('/api/admin/movies', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setMovies((prev) => prev.filter((m) => m.id !== id));
        setEditingMovie(null);
        setEditingTVSeries(null);
        setDeleteConfirm(null);
        showToast('Deleted successfully', 'success');
      } else {
        const { error } = await res.json();
        showToast(`Delete failed: ${error}`, 'error');
      }
    } finally {
      setActionLoading(null);
    }
  };

  // Payment Verification
  const verifyPayment = async (purchaseId: string, status: 'verified' | 'rejected') => {
    setActionLoading(purchaseId);
    try {
      const res = await fetch('/api/payments/verify', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchaseId, status }),
      });
      if (res.ok) {
        setPurchases((prev) => prev.filter((p) => p.id !== purchaseId));
        showToast(`Payment ${status}`, 'success');
      }
    } finally {
      setActionLoading(null);
    }
  };

  // User Roles & Access
  const setUserRole = async (userId: string, newRole: 'user' | 'editor' | 'moderator' | 'admin') => {
    setActionLoading(userId);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId, role: newRole, is_admin: newRole === 'admin' }),
      });
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role: newRole, is_admin: newRole === 'admin' } : u))
        );
        showToast(`User role updated to ${newRole.toUpperCase()}`, 'success');
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleGrantAccess = async (userId: string) => {
    setActionLoading(`grant-${userId}`);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, type: 'full' }),
      });
      if (res.ok) {
        const { purchase } = await res.json();
        setUsers((prev) =>
          prev.map((u) => u.id === userId ? { ...u, purchases: [purchase, ...u.purchases] } : u)
        );
        showToast('VIP Lifetime Access granted successfully!', 'success');
      }
    } finally {
      setActionLoading(null);
    }
  };

  if (isLoading || loading || !canMaintain) {
    return (
      <div className="pt-32 flex justify-center">
        <LoadingSpinner size="lg" text="Loading admin panel..." />
      </div>
    );
  }

  return (
    <div className="pt-24 pb-16 min-h-screen bg-dark-950 text-white page-enter">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-white">Admin Panel</h1>
          <p className="text-dark-400 text-sm mt-1">Manage movies, TV series, payments, users, and streaming options</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
          <div className="p-4 rounded-xl bg-dark-800/50 border border-white/5">
            <p className="text-2xl font-bold text-white">{moviesList.length}</p>
            <p className="text-xs text-dark-400 mt-1">Total Movies</p>
          </div>
          <div className="p-4 rounded-xl bg-dark-800/50 border border-white/5">
            <p className="text-2xl font-bold text-[#00ff73]">{tvSeriesList.length}</p>
            <p className="text-xs text-dark-400 mt-1">Total TV Series</p>
          </div>
          <div className="p-4 rounded-xl bg-dark-800/50 border border-white/5">
            <p className="text-2xl font-bold text-brand-400">{purchases.length}</p>
            <p className="text-xs text-dark-400 mt-1">Pending Payments</p>
          </div>
          <div className="p-4 rounded-xl bg-dark-800/50 border border-white/5">
            <p className="text-2xl font-bold text-purple-400">{users.length}</p>
            <p className="text-xs text-dark-400 mt-1">Users</p>
          </div>
          <div className="p-4 rounded-xl bg-dark-800/50 border border-white/5">
            <p className="text-2xl font-bold text-yellow-400">{movies.filter(m => m.is_published).length}</p>
            <p className="text-xs text-dark-400 mt-1">Published Items</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-dark-800/50 border border-white/5 mb-8 w-fit flex-wrap">
          {(['movies', 'tv_series', 'payments', 'users', 'add'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2.5 text-sm font-medium rounded-lg transition-all ${
                tab === t
                  ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/25 font-bold'
                  : 'text-dark-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {t === 'movies' && `🎬 Movies (${moviesList.length})`}
              {t === 'tv_series' && `📺 TV Series (${tvSeriesList.length})`}
              {t === 'payments' && `💳 Payments (${purchases.length})`}
              {t === 'users' && `👥 Users${users.length > 0 ? ` (${users.length})` : ''}`}
              {t === 'add' && '➕ Add Media'}
            </button>
          ))}
        </div>

        {/* MOVIES TAB */}
        {tab === 'movies' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 max-w-md mb-2">
              <svg className="w-4 h-4 text-dark-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={movieSearch}
                onChange={(e) => setMovieSearch(e.target.value)}
                placeholder="Search movies by title..."
                className="w-full bg-transparent text-white text-sm placeholder-dark-500 focus:outline-none"
              />
            </div>

            {filteredMovies.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-dark-400 mb-4">No movies found</p>
                <button onClick={() => setTab('add')} className="px-5 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-500">
                  Add First Movie
                </button>
              </div>
            ) : (
              filteredMovies.map((movie) => (
                <div key={movie.id} className="rounded-xl bg-dark-800/50 border border-white/5 overflow-hidden">
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-12 h-16 rounded-lg bg-dark-700 overflow-hidden flex-shrink-0">
                        {movie.poster_url && <img src={movie.poster_url} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{movie.title}</p>
                        <p className="text-xs text-dark-400 mt-0.5">
                          {movie.release_year} • ⭐ {movie.rating?.toFixed(1)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => togglePublish(movie)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                          movie.is_published ? 'bg-green-500/15 text-green-400 border border-green-500/30' : 'bg-red-500/15 text-red-400 border border-red-500/30'
                        }`}
                      >
                        {movie.is_published ? 'Published' : 'Hidden'}
                      </button>
                      <button
                        onClick={() => startEditMovie(movie)}
                        className="px-3 py-1.5 rounded-lg text-xs bg-white/5 hover:bg-white/10 text-white font-medium"
                      >
                        ✏️ Edit Streams
                      </button>
                    </div>
                  </div>

                  {/* Movie Server Drawer */}
                  {editingMovie === movie.id && (
                    <div className="border-t border-white/5 p-6 bg-dark-900/50 space-y-6 animate-fade-in">
                      {/* Free Servers */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <label className="text-xs font-bold text-green-400 uppercase tracking-wider">
                            🎬 Free Servers (With Ads)
                          </label>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-dark-400">Quick Add:</span>
                            <button onClick={() => addServer('free', 'VOE')} className="px-2.5 py-1 text-xs rounded bg-white/5 hover:bg-white/10 text-dark-200">+ VOE</button>
                            <button onClick={() => addServer('free', 'Abyss')} className="px-2.5 py-1 text-xs rounded bg-white/5 hover:bg-white/10 text-dark-200">+ Abyss</button>
                            <button onClick={() => addServer('free', 'Doodstream')} className="px-2.5 py-1 text-xs rounded bg-white/5 hover:bg-white/10 text-dark-200">+ Doodstream</button>
                          </div>
                        </div>

                        <div className="space-y-3">
                          {editForm.free_servers.map((server, idx) => (
                            <div key={server.id || idx} className="p-3.5 rounded-xl bg-dark-800/80 border border-white/5 space-y-2">
                              <div className="flex items-center justify-between gap-3">
                                <input
                                  type="text"
                                  value={server.name}
                                  onChange={(e) => updateServer('free', idx, 'name', e.target.value)}
                                  placeholder="Server Name (e.g. Server 1)"
                                  className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs font-semibold"
                                />
                                <div className="flex items-center gap-2">
                                  <select
                                    value={server.input_type}
                                    onChange={(e) => updateServer('free', idx, 'input_type', e.target.value as any)}
                                    className="px-2.5 py-1 rounded bg-dark-900 border border-white/10 text-white text-xs"
                                  >
                                    <option value="url">Direct URL</option>
                                    <option value="embed">Embed HTML Code</option>
                                  </select>
                                  <button onClick={() => moveServer('free', idx, 'up')} disabled={idx === 0} className="px-2 py-1 bg-white/5 text-xs rounded disabled:opacity-30">▲</button>
                                  <button onClick={() => moveServer('free', idx, 'down')} disabled={idx === editForm.free_servers.length - 1} className="px-2 py-1 bg-white/5 text-xs rounded disabled:opacity-30">▼</button>
                                  <button onClick={() => removeServer('free', idx)} className="px-2 py-1 bg-red-500/10 text-red-400 text-xs rounded">✕</button>
                                </div>
                              </div>
                              <input
                                type="text"
                                value={server.input_type === 'embed' ? (server.embed_code || '') : (server.url || '')}
                                onChange={(e) => updateServer('free', idx, server.input_type === 'embed' ? 'embed_code' : 'url', e.target.value)}
                                placeholder={server.input_type === 'embed' ? '<iframe src="..." ...></iframe>' : 'https://stream-url.com/embed/...'}
                                className="w-full px-3 py-2 rounded-lg bg-dark-950 border border-white/10 text-white text-xs font-mono"
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* VIP Servers */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <label className="text-xs font-bold text-brand-400 uppercase tracking-wider">
                            👑 VIP Servers (Ad-Free)
                          </label>
                          <button onClick={() => addServer('vip', 'Google Drive')} className="px-2.5 py-1 text-xs rounded bg-brand-500/10 text-brand-300 border border-brand-500/20">
                            + Google Drive
                          </button>
                        </div>

                        <div className="space-y-3">
                          {editForm.vip_servers.map((server, idx) => (
                            <div key={server.id || idx} className="p-3.5 rounded-xl bg-dark-800/80 border border-white/5 space-y-2">
                              <div className="flex items-center justify-between gap-3">
                                <input
                                  type="text"
                                  value={server.name}
                                  onChange={(e) => updateServer('vip', idx, 'name', e.target.value)}
                                  className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs font-semibold"
                                />
                                <button onClick={() => removeServer('vip', idx)} className="px-2 py-1 bg-red-500/10 text-red-400 text-xs rounded">✕</button>
                              </div>
                              <input
                                type="text"
                                value={server.url || ''}
                                onChange={(e) => updateServer('vip', idx, 'url', e.target.value)}
                                placeholder="Google Drive / Direct URL"
                                className="w-full px-3 py-2 rounded-lg bg-dark-950 border border-white/10 text-white text-xs font-mono"
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Runtime & Description */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-dark-300 mb-1">Runtime (minutes)</label>
                          <input
                            type="number"
                            value={editForm.runtime}
                            onChange={(e) => setEditForm({ ...editForm, runtime: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-dark-300 mb-1">Description (Overview)</label>
                          <textarea
                            value={editForm.description}
                            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                            rows={3}
                            className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-white/5">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => saveMovieEdit(movie)}
                            disabled={actionLoading === movie.id}
                            className="px-5 py-2.5 rounded-xl bg-brand-600 text-white text-xs font-bold hover:bg-brand-500 disabled:opacity-50"
                          >
                            {actionLoading === movie.id ? 'Saving...' : '💾 Save Changes'}
                          </button>
                          {saveMessage && <span className="text-xs text-green-400 font-bold">✓ {saveMessage}</span>}
                        </div>
                        <button onClick={() => handleDeleteItem(movie.id)} className="px-3 py-1.5 text-xs rounded-lg text-red-400 hover:bg-red-500/10">
                          🗑️ Delete Movie
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* TV SERIES TAB */}
        {tab === 'tv_series' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 max-w-md mb-2">
              <svg className="w-4 h-4 text-dark-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={tvSearch}
                onChange={(e) => setTvSearch(e.target.value)}
                placeholder="Search TV series..."
                className="w-full bg-transparent text-white text-sm placeholder-dark-500 focus:outline-none"
              />
            </div>

            {filteredTVSeries.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-dark-400 mb-4">No TV series found</p>
                <button onClick={() => setTab('add')} className="px-5 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-500">
                  Add First TV Series
                </button>
              </div>
            ) : (
              filteredTVSeries.map((series) => {
                const tvData = series.free_servers || {};
                const numSeasons = tvData.seasons?.length || 1;
                const statusStr = tvData.status || 'Completed';

                return (
                  <div key={series.id} className="rounded-xl bg-dark-800/50 border border-white/5 overflow-hidden">
                    <div className="flex items-center justify-between p-4 flex-wrap gap-4">
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        <div className="w-12 h-16 rounded-lg bg-dark-700 overflow-hidden flex-shrink-0">
                          {series.poster_url && <img src={series.poster_url} alt="" className="w-full h-full object-cover" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-white truncate">{series.title}</p>
                            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-[#00ff73]/15 text-[#00ff73] uppercase">
                              {statusStr}
                            </span>
                          </div>
                          <p className="text-xs text-dark-400 mt-1">
                            {series.release_year} • ⭐ {series.rating?.toFixed(1)} • {numSeasons} Season{numSeasons > 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => togglePublish(series)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                            series.is_published ? 'bg-green-500/15 text-green-400 border border-green-500/30' : 'bg-red-500/15 text-red-400 border border-red-500/30'
                          }`}
                        >
                          {series.is_published ? 'Published' : 'Hidden'}
                        </button>
                        <button
                          onClick={() => startEditTVSeries(series)}
                          className="px-4 py-1.5 rounded-lg text-xs bg-[#00ff73]/20 hover:bg-[#00ff73]/30 text-[#00ff73] font-bold border border-[#00ff73]/30"
                        >
                          ⚙️ Manage Seasons & Episodes
                        </button>
                        <button onClick={() => handleDeleteItem(series.id)} className="px-2.5 py-1.5 rounded-lg text-xs text-red-400/70 hover:text-red-400 hover:bg-red-500/10">
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TV SERIES SEASON & EPISODE MODAL EDITOR */}
        {editingTVSeries && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setEditingTVSeries(null)} />
            <div className="relative w-full max-w-4xl max-h-[90vh] bg-dark-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col z-10 animate-scale-in">
              <div className="p-4 border-b border-white/10 flex items-center justify-between bg-dark-800/80">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>📺 Edit TV Series:</span>
                    <span className="text-[#00ff73]">{tvEditForm.title}</span>
                  </h3>
                  <p className="text-xs text-dark-400 mt-0.5">Manage Seasons, Episodes, Description, and Stream Servers (SERVER 1 to 6)</p>
                </div>
                <button onClick={() => setEditingTVSeries(null)} className="text-dark-400 hover:text-white p-2">✕</button>
              </div>

              <div className="p-6 overflow-y-auto space-y-6 flex-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-dark-300 uppercase mb-1">Series Title</label>
                    <input
                      type="text"
                      value={tvEditForm.title}
                      onChange={(e) => setTvEditForm({ ...tvEditForm, title: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-dark-300 uppercase mb-1">Series Status</label>
                    <select
                      value={tvEditForm.status}
                      onChange={(e) => setTvEditForm({ ...tvEditForm, status: e.target.value as any })}
                      className="w-full px-3 py-2 rounded-xl bg-dark-800 border border-white/10 text-white text-sm focus:outline-none cursor-pointer"
                    >
                      <option value="Completed">SERIES FINISHED (COMPLETED)</option>
                      <option value="Ongoing">SERIES ONGOING</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-dark-300 uppercase mb-1">Description (Overview / Sinhala Synopsis)</label>
                  <textarea
                    value={tvEditForm.description}
                    onChange={(e) => setTvEditForm({ ...tvEditForm, description: e.target.value })}
                    rows={3}
                    placeholder="Enter series synopsis or Sinhala dubbed description..."
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[#00ff73]"
                  />
                </div>

                {/* Seasons */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">SEASONS</label>
                    <button
                      onClick={() => {
                        const newSeasonNum = tvEditForm.seasons.length + 1;
                        const newSeason: TVSeason = {
                          season_number: newSeasonNum,
                          name: `SEASON ${newSeasonNum}`,
                          episodes: Array.from({ length: 10 }, (_, i) => ({
                            episode_number: i + 1,
                            title: `Episode ${i + 1}`,
                            servers: [
                              { name: 'SERVER 1', input_type: 'url', url: '', enabled: true },
                              { name: 'SERVER 2', input_type: 'url', url: '', enabled: true },
                              { name: 'SERVER 3', input_type: 'url', url: '', enabled: true },
                              { name: 'SERVER 4', input_type: 'url', url: '', enabled: true },
                              { name: 'SERVER 5', input_type: 'url', url: '', enabled: true },
                              { name: 'SERVER 6', input_type: 'url', url: '', enabled: true },
                            ]
                          }))
                        };
                        setTvEditForm({ ...tvEditForm, seasons: [...tvEditForm.seasons, newSeason] });
                        setSelectedSeasonIdx(tvEditForm.seasons.length);
                        setSelectedEpisodeIdx(0);
                      }}
                      className="text-xs text-[#00ff73] font-bold hover:underline"
                    >
                      + Add Season
                    </button>
                  </div>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {tvEditForm.seasons.map((s, idx) => (
                      <button
                        key={s.season_number}
                        onClick={() => { setSelectedSeasonIdx(idx); setSelectedEpisodeIdx(0); }}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all uppercase ${
                          selectedSeasonIdx === idx
                            ? 'bg-[#00ff73] text-black font-extrabold shadow-md shadow-[#00ff73]/20'
                            : 'bg-white/5 text-white hover:bg-white/10 border border-white/10'
                        }`}
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Episodes */}
                {tvEditForm.seasons[selectedSeasonIdx] && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">EPISODES</label>
                      <button
                        onClick={() => {
                          const seasons = [...tvEditForm.seasons];
                          const currSeason = seasons[selectedSeasonIdx];
                          const newEpNum = currSeason.episodes.length + 1;
                          currSeason.episodes.push({
                            episode_number: newEpNum,
                            title: `Episode ${newEpNum}`,
                            servers: [
                              { name: 'SERVER 1', input_type: 'url', url: '', enabled: true },
                              { name: 'SERVER 2', input_type: 'url', url: '', enabled: true },
                              { name: 'SERVER 3', input_type: 'url', url: '', enabled: true },
                              { name: 'SERVER 4', input_type: 'url', url: '', enabled: true },
                              { name: 'SERVER 5', input_type: 'url', url: '', enabled: true },
                              { name: 'SERVER 6', input_type: 'url', url: '', enabled: true },
                            ]
                          });
                          setTvEditForm({ ...tvEditForm, seasons });
                          setSelectedEpisodeIdx(currSeason.episodes.length - 1);
                        }}
                        className="text-xs text-[#00ff73] font-bold hover:underline"
                      >
                        + Add Episode
                      </button>
                    </div>
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
                      {tvEditForm.seasons[selectedSeasonIdx].episodes.map((ep, idx) => (
                        <button
                          key={ep.episode_number}
                          onClick={() => setSelectedEpisodeIdx(idx)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all uppercase ${
                            selectedEpisodeIdx === idx
                              ? 'bg-[#00ff73] text-black font-extrabold shadow-md'
                              : 'bg-white/5 text-white hover:bg-white/10 border border-white/10'
                          }`}
                        >
                          EP {ep.episode_number}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Episode Servers Editor */}
                {tvEditForm.seasons[selectedSeasonIdx]?.episodes[selectedEpisodeIdx] && (
                  <div className="bg-white/5 border border-white/10 p-4 rounded-2xl space-y-4">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                      <h4 className="text-sm font-bold text-white">
                        Servers for Season {tvEditForm.seasons[selectedSeasonIdx].season_number} — Episode {tvEditForm.seasons[selectedSeasonIdx].episodes[selectedEpisodeIdx].episode_number}
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {Array.from({ length: 6 }, (_, srvIdx) => {
                        const ep = tvEditForm.seasons[selectedSeasonIdx].episodes[selectedEpisodeIdx];
                        const server = ep.servers[srvIdx] || { name: `SERVER ${srvIdx + 1}`, input_type: 'url', url: '', enabled: true };

                        return (
                          <div key={srvIdx} className="p-3 rounded-xl bg-dark-800/90 border border-white/10 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-extrabold text-[#00ff73] uppercase">SERVER {srvIdx + 1}</span>
                              <div className="flex items-center gap-2">
                                <label className="text-[10px] text-dark-400">Mode:</label>
                                <select
                                  value={server.input_type || 'url'}
                                  onChange={(e) => {
                                    const seasons = [...tvEditForm.seasons];
                                    const servers = [...seasons[selectedSeasonIdx].episodes[selectedEpisodeIdx].servers];
                                    servers[srvIdx] = { ...servers[srvIdx], input_type: e.target.value as any };
                                    seasons[selectedSeasonIdx].episodes[selectedEpisodeIdx].servers = servers;
                                    setTvEditForm({ ...tvEditForm, seasons });
                                  }}
                                  className="text-[11px] bg-dark-900 text-white rounded px-2 py-0.5 border border-white/10"
                                >
                                  <option value="url">Direct URL</option>
                                  <option value="embed">Embed Code</option>
                                </select>
                              </div>
                            </div>

                            <input
                              type="text"
                              value={server.input_type === 'embed' ? (server.embed_code || '') : (server.url || '')}
                              onChange={(e) => {
                                const seasons = [...tvEditForm.seasons];
                                const servers = [...seasons[selectedSeasonIdx].episodes[selectedEpisodeIdx].servers];
                                if (server.input_type === 'embed') {
                                  servers[srvIdx] = { ...servers[srvIdx], embed_code: e.target.value, name: `SERVER ${srvIdx + 1}` };
                                } else {
                                  servers[srvIdx] = { ...servers[srvIdx], url: e.target.value, name: `SERVER ${srvIdx + 1}` };
                                }
                                seasons[selectedSeasonIdx].episodes[selectedEpisodeIdx].servers = servers;
                                setTvEditForm({ ...tvEditForm, seasons });
                              }}
                              placeholder={server.input_type === 'embed' ? '<iframe src="..." ...></iframe>' : 'https://stream-url.com/embed/...'}
                              className="w-full px-3 py-2 rounded-lg bg-dark-950 border border-white/10 text-white text-xs font-mono placeholder-dark-500 focus:outline-none focus:border-[#00ff73]"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-white/10 bg-dark-800/80 flex items-center justify-between">
                <button
                  onClick={() => setEditingTVSeries(null)}
                  className="px-5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const targetSeries = movies.find(m => m.id === editingTVSeries);
                    if (targetSeries) saveTVSeriesEdit(targetSeries);
                  }}
                  className="px-6 py-2.5 rounded-xl bg-[#00ff73] text-black font-bold text-sm shadow-lg shadow-[#00ff73]/20 hover:scale-105 transition-transform"
                >
                  💾 Save All Seasons & Episodes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PAYMENTS TAB */}
        {tab === 'payments' && (
          <div className="space-y-4">
            {purchases.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-dark-400">No pending payments</p>
              </div>
            ) : (
              purchases.map((p) => (
                <div key={p.id} className="p-4 rounded-xl bg-dark-800/50 border border-white/5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">{p.profiles?.email}</p>
                    <p className="text-xs text-dark-400">Amount: {formatCurrency(p.amount)} • Method: {p.payment_method}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => verifyPayment(p.id, 'verified')} className="px-3 py-1.5 rounded-lg text-xs bg-green-500/20 text-green-400">Approve</button>
                    <button onClick={() => verifyPayment(p.id, 'rejected')} className="px-3 py-1.5 rounded-lg text-xs bg-red-500/20 text-red-400">Reject</button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* USERS TAB */}
        {tab === 'users' && (
          <div className="space-y-4">
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Search users..."
              className="w-full max-w-md px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm"
            />
            {filteredUsers.map((u) => (
              <div key={u.id} className="p-4 rounded-xl bg-dark-800/50 border border-white/5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">{u.full_name || u.email}</p>
                  <p className="text-xs text-dark-400">{u.email}</p>
                </div>
                <button onClick={() => handleGrantAccess(u.id)} className="px-3 py-1.5 rounded-lg text-xs bg-brand-600 text-white">Grant VIP</button>
              </div>
            ))}
          </div>
        )}

        {/* ADD MEDIA TAB */}
        {tab === 'add' && (
          <div className="max-w-2xl">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-lg font-semibold text-white mb-1">Add New Movie or TV Series</h2>
              <p className="text-sm text-dark-400 mb-6">Search TMDB to add Movies or TV Series directly to DubLK</p>

              <div className="mb-6">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tmdbSearch}
                    onChange={(e) => setTmdbSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleTmdbSearch()}
                    placeholder="Search movie or TV series title on TMDB..."
                    className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-dark-500 focus:outline-none"
                  />
                  <button onClick={handleTmdbSearch} className="px-6 py-3 rounded-xl bg-brand-600 text-white font-medium hover:bg-brand-500">Search</button>
                </div>
              </div>

              {tmdbResults.length > 0 && !selectedTmdb && (
                <div className="mb-6 max-h-60 overflow-y-auto space-y-2 rounded-xl border border-white/10 p-2">
                  {tmdbResults.map((result: any) => {
                    const isTV = result.media_type === 'tv' || result.name !== undefined;
                    return (
                      <button
                        key={result.id}
                        onClick={() => setSelectedTmdb(result)}
                        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 text-left"
                      >
                        {result.poster_path && (
                          <img src={`https://image.tmdb.org/t/p/w92${result.poster_path}`} alt="" className="w-10 h-14 rounded object-cover" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-white truncate">{result.name || result.title}</p>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${isTV ? 'bg-[#00ff73]/20 text-[#00ff73]' : 'bg-brand-500/20 text-brand-300'}`}>
                              {isTV ? 'TV' : 'MOVIE'}
                            </span>
                          </div>
                          <p className="text-xs text-dark-500">⭐ {result.vote_average?.toFixed(1)}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {selectedTmdb && (
                <div className="mb-6">
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-brand-500/10 border border-brand-500/20 mb-6">
                    {selectedTmdb.poster_path && (
                      <img src={`https://image.tmdb.org/t/p/w92${selectedTmdb.poster_path}`} alt="" className="w-12 h-16 rounded object-cover" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">{selectedTmdb.name || selectedTmdb.title}</p>
                      <p className="text-xs text-dark-400">⭐ {selectedTmdb.vote_average?.toFixed(1)}</p>
                    </div>
                    <button onClick={() => setSelectedTmdb(null)} className="ml-auto text-dark-400 hover:text-white">✕</button>
                  </div>

                  <button
                    onClick={handleAddMedia}
                    disabled={publishing}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 text-white font-semibold shadow-lg shadow-brand-500/25"
                  >
                    {publishing ? 'Adding...' : `🚀 Add & Publish ${selectedTmdb.media_type === 'tv' || selectedTmdb.name ? 'TV Series' : 'Movie'}`}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
