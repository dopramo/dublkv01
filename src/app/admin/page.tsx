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
  vip_servers?: StreamServer[];
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

interface ComingSoonAdminItem {
  id: string;
  title: string;
  type: 'movie' | 'tv';
  poster_url: string;
  backdrop_url?: string | null;
  description?: string | null;
  release_date?: string | null;
  genres?: string[];
  rating?: number;
  tmdb_id?: number | null;
  created_at: string;
  updated_at?: string;
}

type Tab = 'movies' | 'tv_series' | 'coming_soon' | 'payments' | 'users' | 'add';

export default function AdminPage() {
  const { user, isAdmin, canMaintain, isLoading } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('movies');
  const [movies, setMovies] = useState<Movie[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [comingSoonList, setComingSoonList] = useState<ComingSoonAdminItem[]>([]);
  const [comingSoonSearch, setComingSoonSearch] = useState('');
  const [editingCSId, setEditingCSId] = useState<string | null>(null);
  const [csTmdbSearch, setCsTmdbSearch] = useState('');
  const [csTmdbResults, setCsTmdbResults] = useState<any[]>([]);
  const [csTmdbLoading, setCsTmdbLoading] = useState(false);
  const [csForm, setCsForm] = useState<{
    title: string;
    type: 'movie' | 'tv';
    poster_url: string;
    release_date: string;
    description: string;
    rating: string;
  }>({ title: '', type: 'movie', poster_url: '', release_date: 'Coming Soon', description: '', rating: '0' });
  const [showAddCSModal, setShowAddCSModal] = useState(false);
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
  const [tvServerTab, setTvServerTab] = useState<'free' | 'vip'>('free');

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
  const [paymentSearch, setPaymentSearch] = useState('');

  // Users & Payments Tab state
  const [usersLoading, setUsersLoading] = useState(false);
  const [paymentSubTab, setPaymentSubTab] = useState<'pending' | 'verified' | 'rejected' | 'all'>('pending');
  const [selectedUserSlips, setSelectedUserSlips] = useState<{ user: any; slips: any[] } | null>(null);
  const [viewingSlip, setViewingSlip] = useState<{
    id?: string;
    url: string;
    email?: string;
    name?: string;
    method?: string;
    amount?: number;
    status?: string;
    date?: string;
    type?: string;
  } | null>(null);

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
        const [moviesRes, paymentsRes, csRes] = await Promise.all([
          fetch('/api/admin/movies'),
          fetch('/api/payments/verify?status=all'),
          fetch('/api/admin/coming-soon'),
        ]);

        if (moviesRes.ok) {
          const { movies } = await moviesRes.json();
          setMovies(movies || []);
        }
        if (paymentsRes.ok) {
          const { purchases } = await paymentsRes.json();
          setPurchases(purchases || []);
        }
        if (csRes.ok) {
          const { comingSoon } = await csRes.json();
          setComingSoonList(comingSoon || []);
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

  const pendingPurchases = purchases.filter(p => p.status === 'pending');
  const verifiedPurchases = purchases.filter(p => p.status === 'verified');
  const rejectedPurchases = purchases.filter(p => p.status === 'rejected');

  const filteredPurchases = purchases.filter((p) => {
    const matchesTab =
      paymentSubTab === 'all' ||
      (paymentSubTab === 'pending' && p.status === 'pending') ||
      (paymentSubTab === 'verified' && p.status === 'verified') ||
      (paymentSubTab === 'rejected' && p.status === 'rejected');

    const email = (p.profiles?.email || p.user_id || '').toLowerCase();
    const name = (p.profiles?.full_name || '').toLowerCase();
    const method = (p.payment_method || '').toLowerCase();
    const search = paymentSearch.toLowerCase();

    const matchesSearch = !search || email.includes(search) || name.includes(search) || method.includes(search);

    return matchesTab && matchesSearch;
  });

  // Payment Verification
  const verifyPayment = async (purchaseId: string, status: 'verified' | 'rejected' | 'pending') => {
    setActionLoading(`verify-${purchaseId}`);
    try {
      const res = await fetch('/api/payments/verify', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchaseId, status }),
      });
      if (res.ok) {
        const { purchase: updated } = await res.json();
        setPurchases((prev) => prev.map((p) => (p.id === purchaseId ? { ...p, status } : p)));
        setUsers((prev) =>
          prev.map((u) => {
            if (u.id === updated.user_id) {
              const purchases = u.purchases || [];
              const exists = purchases.some((p: any) => p.id === purchaseId);
              const newPurchases = exists
                ? purchases.map((p: any) => (p.id === purchaseId ? { ...p, status } : p))
                : [updated, ...purchases];
              return { ...u, purchases: newPurchases };
            }
            return u;
          })
        );
        showToast(
          `Payment ${status === 'verified' ? 'Approved (VIP Unlocked)' : status === 'rejected' ? 'Rejected' : 'Reset to Pending'}`,
          'success'
        );
        if (viewingSlip && viewingSlip.id === purchaseId) {
          setViewingSlip((prev) => (prev ? { ...prev, status } : null));
        }
      } else {
        const { error } = await res.json();
        showToast(`Verification failed: ${error}`, 'error');
      }
    } catch (err: any) {
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // User Roles & Access
  const setUserRole = async (userId: string, newRole: 'user' | 'editor' | 'moderator' | 'admin') => {
    setActionLoading(`role-${userId}`);
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
      } else {
        const { error } = await res.json();
        showToast(`Role update failed: ${error}`, 'error');
      }
    } catch (err: any) {
      showToast(`Role update failed: ${err.message}`, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleGrantAccess = async (userId: string, type: 'single' | 'full' = 'full') => {
    setActionLoading(`grant-${userId}`);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, type }),
      });
      if (res.ok) {
        const { purchase } = await res.json();
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, purchases: [purchase, ...(u.purchases || [])] } : u))
        );
        setPurchases((prev) => [purchase, ...prev]);
        showToast(`VIP ${type === 'full' ? 'Lifetime' : '1 Month'} Access granted!`, 'success');
      } else {
        const { error } = await res.json();
        showToast(`Grant VIP failed: ${error}`, 'error');
      }
    } catch (err: any) {
      showToast(`Grant VIP error: ${err.message}`, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevokeAccess = async (userId: string, purchaseId: string) => {
    setActionLoading(`revoke-${purchaseId}`);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchaseId }),
      });
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, purchases: (u.purchases || []).filter((p: any) => p.id !== purchaseId) } : u))
        );
        setPurchases((prev) => prev.filter((p) => p.id !== purchaseId));
        showToast('VIP Access revoked successfully!', 'success');
      } else {
        const { error } = await res.json();
        showToast(`Revoke failed: ${error}`, 'error');
      }
    } catch (err: any) {
      showToast(`Revoke error: ${err.message}`, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUserAccount = async (userId: string, userEmail: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete user "${userEmail}"? This action cannot be undone.`)) return;
    setActionLoading(`delete-user-${userId}`);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: userId }),
      });
      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== userId));
        setPurchases((prev) => prev.filter((p) => p.user_id !== userId));
        showToast('User account deleted successfully', 'success');
      } else {
        const { error } = await res.json();
        showToast(`Delete user failed: ${error}`, 'error');
      }
    } catch (err: any) {
      showToast(`Delete error: ${err.message}`, 'error');
    } finally {
      setActionLoading(null);
    }
  };

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

    const normalizeTVEpisodes = (rawEps: any[], tmdbId: number, seasonNum: number): TVEpisode[] => {
      const epsToMap = rawEps && rawEps.length > 0 ? rawEps : Array.from({ length: 10 }, (_, i) => ({ episode_number: i + 1 }));
      return epsToMap.map((ep, i) => {
        const epNum = ep.episode_number || i + 1;
        const rawFree = Array.isArray(ep.servers) ? ep.servers : [];
        const servers: StreamServer[] = Array.from({ length: 6 }, (_, srvIdx) => {
          const s = rawFree[srvIdx];
          if (s) {
            const isEmbed = s.input_type === 'embed' || (s.embed_code && !s.url);
            return {
              id: s.id || `srv-${srvIdx + 1}`,
              name: s.name || `SERVER ${srvIdx + 1}`,
              input_type: isEmbed ? 'embed' : 'url',
              embed_code: s.embed_code || (isEmbed ? s.url || '' : ''),
              url: s.url || (!isEmbed ? s.embed_code || '' : ''),
              enabled: s.enabled !== false,
            };
          }
          return {
            name: `SERVER ${srvIdx + 1}`,
            input_type: 'url',
            url: srvIdx === 0 ? `https://vidsrc.me/embed/tv/${tmdbId}/${seasonNum}/${epNum}` : '',
            embed_code: '',
            enabled: true,
          };
        });

        const rawVip = Array.isArray(ep.vip_servers) ? ep.vip_servers : [];
        const vip_servers: StreamServer[] = Array.from({ length: 6 }, (_, srvIdx) => {
          const s = rawVip[srvIdx];
          if (s) {
            const isEmbed = s.input_type === 'embed' || (s.embed_code && !s.url);
            return {
              id: s.id || `vip-srv-${srvIdx + 1}`,
              name: s.name || `VIP SERVER ${srvIdx + 1}`,
              input_type: isEmbed ? 'embed' : 'url',
              embed_code: s.embed_code || (isEmbed ? s.url || '' : ''),
              url: s.url || (!isEmbed ? s.embed_code || '' : ''),
              enabled: s.enabled !== false,
            };
          }
          return {
            name: `VIP SERVER ${srvIdx + 1}`,
            input_type: 'url',
            url: '',
            embed_code: '',
            enabled: true,
          };
        });

        return {
          episode_number: epNum,
          title: ep.title || `Episode ${epNum}`,
          description: ep.description || '',
          servers,
          vip_servers,
        };
      });
    };

    const seasons: TVSeason[] = (tvPayload.seasons && tvPayload.seasons.length > 0)
      ? tvPayload.seasons.map((s: any, idx: number) => ({
          season_number: s.season_number || idx + 1,
          name: s.name || `SEASON ${s.season_number || idx + 1}`,
          episodes: normalizeTVEpisodes(s.episodes, series.tmdb_id, s.season_number || idx + 1)
        }))
      : [
          {
            season_number: 1,
            name: 'SEASON 1',
            episodes: normalizeTVEpisodes([], series.tmdb_id, 1)
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
    setTvServerTab('free');
    setSaveMessage(null);
  };

  // TV Series Season & Episode Delete Handlers
  const handleDeleteSeason = (seasonIdx: number) => {
    if (tvEditForm.seasons.length <= 1) {
      showToast('Cannot delete the only season.', 'error');
      return;
    }
    const seasonName = tvEditForm.seasons[seasonIdx]?.name || `Season ${seasonIdx + 1}`;
    if (!confirm(`Are you sure you want to delete ${seasonName} and all its episodes?`)) return;

    const updatedSeasons = tvEditForm.seasons
      .filter((_, i) => i !== seasonIdx)
      .map((s, i) => ({
        ...s,
        season_number: i + 1,
        name: `SEASON ${i + 1}`,
      }));

    setTvEditForm({ ...tvEditForm, seasons: updatedSeasons });
    setSelectedSeasonIdx(Math.max(0, seasonIdx - 1));
    setSelectedEpisodeIdx(0);
    showToast(`${seasonName} deleted`, 'success');
  };

  const handleDeleteEpisode = (epIdx: number) => {
    const currSeason = tvEditForm.seasons[selectedSeasonIdx];
    if (!currSeason || currSeason.episodes.length <= 1) {
      showToast('Cannot delete the only episode in a season.', 'error');
      return;
    }
    const epNum = currSeason.episodes[epIdx]?.episode_number || epIdx + 1;
    if (!confirm(`Are you sure you want to delete Episode ${epNum}?`)) return;

      const updatedEpisodes = currSeason.episodes
      .filter((_, i) => i !== epIdx)
      .map((ep, i) => ({
        ...ep,
        episode_number: i + 1,
        title: `Episode ${i + 1}`,
      }));
    const seasons = [...tvEditForm.seasons];
    seasons[selectedSeasonIdx].episodes = updatedEpisodes;
    setTvEditForm({ ...tvEditForm, seasons });
    setSelectedEpisodeIdx(Math.max(0, epIdx - 1));
    showToast(`Episode ${epNum} deleted`, 'success');
  };

  const handleClearServer = (type: 'free' | 'vip', srvIdx: number) => {
    const seasons = [...tvEditForm.seasons];
    const ep = { ...seasons[selectedSeasonIdx].episodes[selectedEpisodeIdx] };
    const key = type === 'vip' ? 'vip_servers' : 'servers';
    const serverList = ep[key] ? [...ep[key]!] : [];
    if (serverList[srvIdx]) {
      serverList[srvIdx] = {
        ...serverList[srvIdx],
        url: '',
        embed_code: '',
      };
      ep[key] = serverList;
      seasons[selectedSeasonIdx].episodes[selectedEpisodeIdx] = ep;
      setTvEditForm({ ...tvEditForm, seasons });
      showToast(`${type === 'vip' ? 'VIP ' : ''}SERVER ${srvIdx + 1} cleared`, 'success');
    }
  };

  const saveMovieEdit = async (movie: Movie) => {
    setActionLoading(movie.id);
    try {
      const res = await fetch('/api/admin/movies', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: movie.id,
          free_servers: editForm.free_servers,
          vip_servers: editForm.vip_servers,
          runtime: editForm.runtime ? parseInt(editForm.runtime) : null,
          description: editForm.description,
        }),
      });

      if (res.ok) {
        const { movie: updated } = await res.json();
        setMovies((prev) => prev.map((m) => (m.id === movie.id ? updated : m)));
        setEditingMovie(null);
        showToast('Movie servers updated successfully!', 'success');
      } else {
        const { error } = await res.json();
        showToast(`Save failed: ${error}`, 'error');
      }
    } catch (err: any) {
      showToast(`Save failed: ${err.message}`, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const saveTVSeriesEdit = async (series: Movie) => {
    setActionLoading(series.id);
    try {
      const freeServersObj = {
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
          free_servers: freeServersObj,
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
    } catch (err: any) {
      showToast(`Save failed: ${err.message}`, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Are you sure you want to delete this title? This action cannot be undone.')) return;
    setActionLoading(id);
    try {
      const res = await fetch('/api/admin/movies', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setMovies((prev) => prev.filter((m) => m.id !== id));
        showToast('Item deleted successfully', 'success');
      } else {
        const { error } = await res.json();
        showToast(`Delete failed: ${error}`, 'error');
      }
    } catch (err: any) {
      showToast(`Delete error: ${err.message}`, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Coming Soon Handlers
  const handleCsTmdbSearch = async () => {
    if (!csTmdbSearch.trim()) return;
    setCsTmdbLoading(true);
    try {
      const res = await fetch(`/api/tmdb/search?q=${encodeURIComponent(csTmdbSearch)}`);
      if (res.ok) {
        const { results } = await res.json();
        setCsTmdbResults(results || []);
      }
    } catch (err) {
      console.error('Failed to search TMDB for coming soon:', err);
    } finally {
      setCsTmdbLoading(false);
    }
  };

  const handleSelectTmdbForCS = (result: any) => {
    const isTv = result.media_type === 'tv' || result.name !== undefined;
    const title = result.name || result.title || '';
    const poster_url = result.poster_path ? `https://image.tmdb.org/t/p/w500${result.poster_path}` : '';
    const release_date = isTv
      ? (result.first_air_date ? result.first_air_date.substring(0, 4) : 'Coming Soon')
      : (result.release_date ? result.release_date.substring(0, 4) : 'Coming Soon');

    setCsForm({
      title,
      type: isTv ? 'tv' : 'movie',
      poster_url,
      release_date,
      description: result.overview || '',
      rating: result.vote_average ? result.vote_average.toFixed(1) : '0',
    });
    setCsTmdbResults([]);
    showToast(`Auto-filled details for "${title}" from TMDB!`, 'success');
  };
  const handleCreateComingSoon = async () => {
    if (!csForm.title || !csForm.poster_url) {
      showToast('Title and Poster URL are required', 'error');
      return;
    }
    setActionLoading('cs-create');
    try {
      const res = await fetch('/api/admin/coming-soon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: csForm.title,
          type: csForm.type,
          poster_url: csForm.poster_url,
          release_date: csForm.release_date || 'Coming Soon',
          description: csForm.description,
          rating: parseFloat(csForm.rating) || 0,
        }),
      });
      if (res.ok) {
        const { comingSoon } = await res.json();
        setComingSoonList((prev) => [comingSoon, ...prev]);
        setShowAddCSModal(false);
        setCsForm({ title: '', type: 'movie', poster_url: '', release_date: 'Coming Soon', description: '', rating: '0' });
        showToast('Coming Soon item added!', 'success');
      } else {
        const { error } = await res.json();
        showToast(`Failed: ${error}`, 'error');
      }
    } catch (err: any) {
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleImportTmdbToComingSoon = async (tmdbItem: any) => {
    setActionLoading(`cs-import-${tmdbItem.id}`);
    try {
      const isTv = tmdbItem.media_type === 'tv';
      const title = tmdbItem.title || tmdbItem.name || 'Untitled';
      const poster_url = tmdbItem.poster_path
        ? `https://image.tmdb.org/t/p/w500${tmdbItem.poster_path}`
        : '';
      const backdrop_url = tmdbItem.backdrop_path
        ? `https://image.tmdb.org/t/p/original${tmdbItem.backdrop_path}`
        : '';
      const release_date = isTv
        ? (tmdbItem.first_air_date ? tmdbItem.first_air_date.substring(0, 4) : 'Coming Soon')
        : (tmdbItem.release_date ? tmdbItem.release_date.substring(0, 4) : 'Coming Soon');

      const res = await fetch('/api/admin/coming-soon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tmdb_id: tmdbItem.id,
          title,
          type: isTv ? 'tv' : 'movie',
          poster_url,
          backdrop_url,
          description: tmdbItem.overview || '',
          release_date,
          rating: tmdbItem.vote_average || 0,
        }),
      });

      if (res.ok) {
        const { comingSoon } = await res.json();
        setComingSoonList((prev) => [comingSoon, ...prev]);
        showToast(`"${title}" added to Coming Soon!`, 'success');
      } else {
        const { error } = await res.json();
        showToast(`Failed to add: ${error}`, 'error');
      }
    } catch (err: any) {
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateComingSoon = async (id: string, updates: Partial<ComingSoonAdminItem>) => {
    setActionLoading(`cs-update-${id}`);
    try {
      const res = await fetch('/api/admin/coming-soon', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      });
      if (res.ok) {
        const { comingSoon } = await res.json();
        setComingSoonList((prev) => prev.map((item) => (item.id === id ? comingSoon : item)));
        setEditingCSId(null);
        showToast('Coming Soon item updated!', 'success');
      } else {
        const { error } = await res.json();
        showToast(`Update failed: ${error}`, 'error');
      }
    } catch (err: any) {
      showToast(`Update error: ${err.message}`, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteComingSoon = async (id: string) => {
    if (!confirm('Are you sure you want to delete this Coming Soon item?')) return;
    setActionLoading(`cs-delete-${id}`);
    try {
      const res = await fetch('/api/admin/coming-soon', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setComingSoonList((prev) => prev.filter((item) => item.id !== id));
        showToast('Coming Soon item deleted', 'success');
      } else {
        const { error } = await res.json();
        showToast(`Delete failed: ${error}`, 'error');
      }
    } catch (err: any) {
      showToast(`Delete error: ${err.message}`, 'error');
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
          {(['movies', 'tv_series', 'coming_soon', 'payments', 'users', 'add'] as Tab[]).map((t) => (
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
              {t === 'coming_soon' && `⏳ Coming Soon (${comingSoonList.length})`}
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
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-dark-400">Quick Add:</span>
                            <button onClick={() => addServer('vip', 'Google Drive')} className="px-2.5 py-1 text-xs rounded bg-brand-500/10 text-brand-300 border border-brand-500/20">+ Google Drive</button>
                            <button onClick={() => addServer('vip', 'VOE')} className="px-2.5 py-1 text-xs rounded bg-white/5 hover:bg-white/10 text-dark-200">+ VOE</button>
                            <button onClick={() => addServer('vip', 'Abyss')} className="px-2.5 py-1 text-xs rounded bg-white/5 hover:bg-white/10 text-dark-200">+ Abyss</button>
                            <button onClick={() => addServer('vip', 'Doodstream')} className="px-2.5 py-1 text-xs rounded bg-white/5 hover:bg-white/10 text-dark-200">+ Doodstream</button>
                          </div>
                        </div>

                        <div className="space-y-3">
                          {editForm.vip_servers.map((server, idx) => (
                            <div key={server.id || idx} className="p-3.5 rounded-xl bg-dark-800/80 border border-white/5 space-y-2">
                              <div className="flex items-center justify-between gap-3">
                                <input
                                  type="text"
                                  value={server.name}
                                  onChange={(e) => updateServer('vip', idx, 'name', e.target.value)}
                                  placeholder="Server Name (e.g. VIP Server 1)"
                                  className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs font-semibold"
                                />
                                <div className="flex items-center gap-2">
                                  <select
                                    value={server.input_type}
                                    onChange={(e) => updateServer('vip', idx, 'input_type', e.target.value as any)}
                                    className="px-2.5 py-1 rounded bg-dark-900 border border-white/10 text-white text-xs"
                                  >
                                    <option value="url">Direct URL</option>
                                    <option value="embed">Embed HTML Code</option>
                                  </select>
                                  <button onClick={() => moveServer('vip', idx, 'up')} disabled={idx === 0} className="px-2 py-1 bg-white/5 text-xs rounded disabled:opacity-30">▲</button>
                                  <button onClick={() => moveServer('vip', idx, 'down')} disabled={idx === editForm.vip_servers.length - 1} className="px-2 py-1 bg-white/5 text-xs rounded disabled:opacity-30">▼</button>
                                  <button onClick={() => removeServer('vip', idx)} className="px-2 py-1 bg-red-500/10 text-red-400 text-xs rounded">✕</button>
                                </div>
                              </div>
                              <input
                                type="text"
                                value={server.input_type === 'embed' ? (server.embed_code || '') : (server.url || '')}
                                onChange={(e) => updateServer('vip', idx, server.input_type === 'embed' ? 'embed_code' : 'url', e.target.value)}
                                placeholder={server.input_type === 'embed' ? '<iframe src="..." ...></iframe>' : 'Google Drive / Direct URL'}
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

                {/* Seasons Header */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">SEASONS</label>
                    <div className="flex items-center gap-3">
                      {tvEditForm.seasons.length > 1 && (
                        <button
                          onClick={() => handleDeleteSeason(selectedSeasonIdx)}
                          className="text-xs text-red-400 font-bold hover:underline flex items-center gap-1"
                        >
                          🗑️ Delete Season {tvEditForm.seasons[selectedSeasonIdx]?.season_number}
                        </button>
                      )}
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
                  </div>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {tvEditForm.seasons.map((s, idx) => (
                      <button
                        key={s.season_number}
                        onClick={() => { setSelectedSeasonIdx(idx); setSelectedEpisodeIdx(0); }}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all uppercase flex items-center gap-2 ${
                          selectedSeasonIdx === idx
                            ? 'bg-[#00ff73] text-black font-extrabold shadow-md shadow-[#00ff73]/20'
                            : 'bg-white/5 text-white hover:bg-white/10 border border-white/10'
                        }`}
                      >
                        <span>{s.name}</span>
                        {tvEditForm.seasons.length > 1 && (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSeason(idx);
                            }}
                            className="hover:text-red-500 font-black text-xs opacity-60 hover:opacity-100 px-1"
                            title="Delete season"
                          >
                            ✕
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Episodes Header */}
                {tvEditForm.seasons[selectedSeasonIdx] && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">EPISODES</label>
                      <div className="flex items-center gap-3">
                        {tvEditForm.seasons[selectedSeasonIdx].episodes.length > 1 && (
                          <button
                            onClick={() => handleDeleteEpisode(selectedEpisodeIdx)}
                            className="text-xs text-red-400 font-bold hover:underline flex items-center gap-1"
                          >
                            🗑️ Delete EP {tvEditForm.seasons[selectedSeasonIdx].episodes[selectedEpisodeIdx]?.episode_number}
                          </button>
                        )}
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
                    </div>
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
                      {tvEditForm.seasons[selectedSeasonIdx].episodes.map((ep, idx) => (
                        <button
                          key={ep.episode_number}
                          onClick={() => setSelectedEpisodeIdx(idx)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all uppercase flex items-center gap-1.5 ${
                            selectedEpisodeIdx === idx
                              ? 'bg-[#00ff73] text-black font-extrabold shadow-md'
                              : 'bg-white/5 text-white hover:bg-white/10 border border-white/10'
                          }`}
                        >
                          <span>EP {ep.episode_number}</span>
                          {tvEditForm.seasons[selectedSeasonIdx].episodes.length > 1 && (
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteEpisode(idx);
                              }}
                              className="hover:text-red-500 font-black text-xs opacity-60 hover:opacity-100 px-1"
                              title="Delete episode"
                            >
                              ✕
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Episode Servers Editor */}
                {tvEditForm.seasons[selectedSeasonIdx]?.episodes[selectedEpisodeIdx] && (
                  <div className="bg-white/5 border border-white/10 p-4 rounded-2xl space-y-4">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3 flex-wrap gap-2">
                      <h4 className="text-sm font-bold text-white">
                        Servers for Season {tvEditForm.seasons[selectedSeasonIdx].season_number} — Episode {tvEditForm.seasons[selectedSeasonIdx].episodes[selectedEpisodeIdx].episode_number}
                      </h4>
                      {/* Sub-tabs for Free vs VIP Episode Servers */}
                      <div className="flex items-center gap-1 bg-dark-900/80 p-1 rounded-xl border border-white/10">
                        <button
                          onClick={() => setTvServerTab('free')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            tvServerTab === 'free'
                              ? 'bg-[#00ff73] text-black shadow-md'
                              : 'text-dark-400 hover:text-white'
                          }`}
                        >
                          🎬 Normal Servers (Free)
                        </button>
                        <button
                          onClick={() => setTvServerTab('vip')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            tvServerTab === 'vip'
                              ? 'bg-brand-500 text-white shadow-md'
                              : 'text-dark-400 hover:text-white'
                          }`}
                        >
                          👑 VIP Servers (Ad-Free)
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {Array.from({ length: 6 }, (_, srvIdx) => {
                        const ep = tvEditForm.seasons[selectedSeasonIdx].episodes[selectedEpisodeIdx];
                        const serverList = tvServerTab === 'vip' ? (ep.vip_servers || []) : (ep.servers || []);
                        const server = serverList[srvIdx] || {
                          name: tvServerTab === 'vip' ? `VIP SERVER ${srvIdx + 1}` : `SERVER ${srvIdx + 1}`,
                          input_type: 'url',
                          url: '',
                          enabled: true
                        };
                        const hasValue = !!(server.url || server.embed_code);
                        const isVip = tvServerTab === 'vip';
                        const labelPrefix = isVip ? 'VIP SERVER' : 'SERVER';

                        return (
                          <div key={srvIdx} className="p-3 rounded-xl bg-dark-800/90 border border-white/10 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className={`text-xs font-extrabold uppercase ${isVip ? 'text-brand-400' : 'text-[#00ff73]'}`}>
                                {labelPrefix} {srvIdx + 1}
                              </span>
                              <div className="flex items-center gap-2">
                                <label className="text-[10px] text-dark-400">Mode:</label>
                                <select
                                  value={server.input_type || 'url'}
                                  onChange={(e) => {
                                    const seasons = [...tvEditForm.seasons];
                                    const currEp = seasons[selectedSeasonIdx].episodes[selectedEpisodeIdx];
                                    const targetKey = isVip ? 'vip_servers' : 'servers';
                                    const updatedList = [...(currEp[targetKey] || [])];
                                    updatedList[srvIdx] = {
                                      ...updatedList[srvIdx],
                                      name: `${labelPrefix} ${srvIdx + 1}`,
                                      input_type: e.target.value as any
                                    };
                                    currEp[targetKey] = updatedList;
                                    setTvEditForm({ ...tvEditForm, seasons });
                                  }}
                                  className="text-[11px] bg-dark-900 text-white rounded px-2 py-0.5 border border-white/10"
                                >
                                  <option value="url">Direct URL</option>
                                  <option value="embed">Embed Code</option>
                                </select>
                                {hasValue && (
                                  <button
                                    onClick={() => handleClearServer(tvServerTab, srvIdx)}
                                    className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 text-[10px] font-bold transition-colors"
                                    title="Clear this server URL/embed"
                                  >
                                    ✕ Clear
                                  </button>
                                )}
                              </div>
                            </div>

                            <input
                              type="text"
                              value={server.input_type === 'embed' ? (server.embed_code || '') : (server.url || '')}
                              onChange={(e) => {
                                const seasons = [...tvEditForm.seasons];
                                const currEp = seasons[selectedSeasonIdx].episodes[selectedEpisodeIdx];
                                const targetKey = isVip ? 'vip_servers' : 'servers';
                                const updatedList = [...(currEp[targetKey] || [])];
                                const val = e.target.value;
                                if (server.input_type === 'embed') {
                                  updatedList[srvIdx] = { ...updatedList[srvIdx], embed_code: val, name: `${labelPrefix} ${srvIdx + 1}` };
                                } else {
                                  updatedList[srvIdx] = { ...updatedList[srvIdx], url: val, name: `${labelPrefix} ${srvIdx + 1}` };
                                }
                                currEp[targetKey] = updatedList;
                                setTvEditForm({ ...tvEditForm, seasons });
                              }}
                              placeholder={server.input_type === 'embed' ? '<iframe src="..." ...></iframe>' : isVip ? 'Google Drive / Direct URL' : 'https://stream-url.com/embed/...'}
                              className={`w-full px-3 py-2 rounded-lg bg-dark-950 border border-white/10 text-white text-xs font-mono placeholder-dark-500 focus:outline-none ${isVip ? 'focus:border-brand-400' : 'focus:border-[#00ff73]'}`}
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

        {/* COMING SOON TAB */}
        {tab === 'coming_soon' && (
          <div className="space-y-6 animate-fade-in">
            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-dark-900/60 p-4 rounded-2xl border border-white/10">
              <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 w-full sm:w-80">
                <svg className="w-4 h-4 text-dark-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={comingSoonSearch}
                  onChange={(e) => setComingSoonSearch(e.target.value)}
                  placeholder="Search coming soon items..."
                  className="w-full bg-transparent text-white text-sm placeholder-dark-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  onClick={() => setShowAddCSModal(true)}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold text-sm shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2"
                >
                  <span>➕ Add Coming Soon Item</span>
                </button>
              </div>
            </div>

            {/* Coming Soon List */}
            {comingSoonList.filter(item => item.title.toLowerCase().includes(comingSoonSearch.toLowerCase())).length === 0 ? (
              <div className="text-center py-16 rounded-2xl bg-dark-900/40 border border-white/5 p-8">
                <div className="text-4xl mb-3">⏳</div>
                <h3 className="text-lg font-bold text-white mb-1">No Coming Soon Items</h3>
                <p className="text-dark-400 text-sm max-w-md mx-auto mb-6">
                  Add movies or TV series to the Coming Soon section. They will appear on the homepage directly below Recently Added Movies.
                </p>
                <button
                  onClick={() => setShowAddCSModal(true)}
                  className="px-6 py-2.5 rounded-xl bg-amber-500 text-black font-bold text-sm hover:bg-amber-400 transition-colors"
                >
                  Add Your First Coming Soon Item
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {comingSoonList
                  .filter(item => item.title.toLowerCase().includes(comingSoonSearch.toLowerCase()))
                  .map((item) => (
                    <div key={item.id} className="p-4 rounded-2xl bg-dark-900/60 border border-white/10 hover:border-amber-500/30 transition-all flex gap-4">
                      {/* Poster */}
                      <div className="w-20 h-28 rounded-xl bg-dark-800 overflow-hidden flex-shrink-0 relative border border-white/10">
                        {item.poster_url ? (
                          <img src={item.poster_url} alt={item.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-dark-500">No Image</div>
                        )}
                        <span className={`absolute top-1 left-1 px-1.5 py-0.5 text-[8px] font-extrabold rounded uppercase ${
                          item.type === 'tv' ? 'bg-purple-500 text-white' : 'bg-blue-500 text-white'
                        }`}>
                          {item.type === 'tv' ? 'TV' : 'Movie'}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          <h4 className="text-sm font-bold text-white truncate">{item.title}</h4>
                          <p className="text-xs text-amber-400 font-medium mt-0.5 flex items-center gap-1">
                            <span>📅</span>
                            <span>{item.release_date || 'Coming Soon'}</span>
                          </p>
                          {item.description && (
                            <p className="text-xs text-dark-400 mt-1 line-clamp-2 leading-relaxed">{item.description}</p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-white/5">
                          <button
                            onClick={() => handleDeleteComingSoon(item.id)}
                            className="px-3 py-1 rounded-lg text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 font-medium transition-colors"
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* ADD COMING SOON MODAL */}
        {showAddCSModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowAddCSModal(false)} />
            <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto bg-dark-900 border border-white/10 rounded-2xl shadow-2xl z-10 animate-scale-in flex flex-col">
              <div className="p-4 border-b border-white/10 flex items-center justify-between bg-dark-800/80 sticky top-0 z-20">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>⏳ Add Coming Soon Item</span>
                </h3>
                <button onClick={() => setShowAddCSModal(false)} className="text-dark-400 hover:text-white p-2">✕</button>
              </div>

              <div className="p-6 space-y-5 flex-1">
                {/* TMDB API Auto-Search Box */}
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                      <span>🎬 Search TMDB API (Auto-Fill)</span>
                    </span>
                    <span className="text-[10px] text-amber-400/80">No manual links needed</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={csTmdbSearch}
                      onChange={(e) => setCsTmdbSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCsTmdbSearch()}
                      placeholder="Type movie or TV series title (e.g. Avatar 3)..."
                      className="flex-1 px-3.5 py-2 rounded-xl bg-dark-950/80 border border-white/10 text-white text-xs placeholder-dark-500 focus:outline-none focus:border-amber-400"
                    />
                    <button
                      onClick={handleCsTmdbSearch}
                      disabled={csTmdbLoading}
                      className="px-4 py-2 rounded-xl bg-amber-500 text-black text-xs font-bold hover:bg-amber-400 transition-colors disabled:opacity-50"
                    >
                      {csTmdbLoading ? 'Searching...' : 'Search TMDB'}
                    </button>
                  </div>

                  {/* TMDB Search Results Dropdown/List */}
                  {csTmdbResults.length > 0 && (
                    <div className="max-h-52 overflow-y-auto space-y-1.5 pt-2 border-t border-amber-500/20">
                      {csTmdbResults.map((res: any) => {
                        const isTV = res.media_type === 'tv' || res.name !== undefined;
                        const resTitle = res.name || res.title;
                        const resYear = isTV ? res.first_air_date?.substring(0, 4) : res.release_date?.substring(0, 4);

                        return (
                          <div
                            key={res.id}
                            className="p-2.5 rounded-lg bg-dark-900/90 border border-white/5 hover:border-amber-500/40 flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer" onClick={() => handleSelectTmdbForCS(res)}>
                              {res.poster_path ? (
                                <img src={`https://image.tmdb.org/t/p/w92${res.poster_path}`} alt="" className="w-8 h-11 rounded object-cover flex-shrink-0" />
                              ) : (
                                <div className="w-8 h-11 rounded bg-dark-800 flex items-center justify-center text-[8px] text-dark-500 flex-shrink-0">No Img</div>
                              )}
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-white truncate">{resTitle}</p>
                                <p className="text-[10px] text-dark-400">{resYear || 'Upcoming'} • ⭐ {res.vote_average?.toFixed(1) || '0'}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <button
                                onClick={() => handleSelectTmdbForCS(res)}
                                className="px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-[10px] font-bold border border-amber-500/30"
                              >
                                ⚡ Auto-Fill
                              </button>
                              <button
                                onClick={() => {
                                  handleImportTmdbToComingSoon(res);
                                  setShowAddCSModal(false);
                                }}
                                className="px-2.5 py-1 rounded bg-amber-500 text-black hover:bg-amber-400 text-[10px] font-extrabold"
                              >
                                🚀 1-Click Add
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Form Fields (Pre-populated from TMDB or Manual) */}
                <div>
                  <label className="block text-xs font-bold text-dark-300 uppercase mb-1">Title *</label>
                  <input
                    type="text"
                    value={csForm.title}
                    onChange={(e) => setCsForm({ ...csForm, title: e.target.value })}
                    placeholder="Title will auto-fill from TMDB above or enter manually..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-dark-300 uppercase mb-1">Type</label>
                    <select
                      value={csForm.type}
                      onChange={(e) => setCsForm({ ...csForm, type: e.target.value as any })}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-dark-800 border border-white/10 text-white text-sm focus:outline-none cursor-pointer"
                    >
                      <option value="movie">🎬 Movie</option>
                      <option value="tv">📺 TV Series</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-dark-300 uppercase mb-1">Release Date / Note</label>
                    <input
                      type="text"
                      value={csForm.release_date}
                      onChange={(e) => setCsForm({ ...csForm, release_date: e.target.value })}
                      placeholder="e.g. 2026 or Coming Dec 2026"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-dark-300 uppercase mb-1">Poster Image URL *</label>
                  <input
                    type="text"
                    value={csForm.poster_url}
                    onChange={(e) => setCsForm({ ...csForm, poster_url: e.target.value })}
                    placeholder="Auto-filled from TMDB above or paste URL..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-amber-500 font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-dark-300 uppercase mb-1">Description (Optional)</label>
                  <textarea
                    value={csForm.description}
                    onChange={(e) => setCsForm({ ...csForm, description: e.target.value })}
                    rows={3}
                    placeholder="Auto-filled from TMDB above or type short synopsis..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="p-4 border-t border-white/10 bg-dark-800/80 flex items-center justify-end gap-3 sticky bottom-0 z-20">
                <button
                  onClick={() => setShowAddCSModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateComingSoon}
                  disabled={actionLoading === 'cs-create'}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shadow-lg shadow-amber-500/20"
                >
                  {actionLoading === 'cs-create' ? 'Adding...' : 'Add Coming Soon Item'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PAYMENTS TAB */}
        {tab === 'payments' && (
          <div className="space-y-6 animate-fade-in">
            {/* Filter Sub-Tabs & Search */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-dark-900/60 p-4 rounded-2xl border border-white/10">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                <button
                  onClick={() => setPaymentSubTab('pending')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    paymentSubTab === 'pending'
                      ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                      : 'bg-white/5 text-dark-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span>⏳ Pending Review</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-black/20 text-[10px]">{pendingPurchases.length}</span>
                </button>
                <button
                  onClick={() => setPaymentSubTab('verified')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    paymentSubTab === 'verified'
                      ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
                      : 'bg-white/5 text-dark-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span>📜 Payment History (Approved)</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-black/20 text-[10px]">{verifiedPurchases.length}</span>
                </button>
                <button
                  onClick={() => setPaymentSubTab('rejected')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    paymentSubTab === 'rejected'
                      ? 'bg-red-500 text-white shadow-lg shadow-red-500/20'
                      : 'bg-white/5 text-dark-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span>❌ Rejected</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-white/20 text-[10px]">{rejectedPurchases.length}</span>
                </button>
                <button
                  onClick={() => setPaymentSubTab('all')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    paymentSubTab === 'all'
                      ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20'
                      : 'bg-white/5 text-dark-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span>🌐 All Payments</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-white/20 text-[10px]">{purchases.length}</span>
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative min-w-[240px]">
                <input
                  type="text"
                  value={paymentSearch}
                  onChange={(e) => setPaymentSearch(e.target.value)}
                  placeholder="Search by email or method..."
                  className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs placeholder-dark-500 focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            {/* Payment Items Grid / List */}
            {filteredPurchases.length === 0 ? (
              <div className="text-center py-16 rounded-2xl bg-dark-900/40 border border-white/5">
                <p className="text-3xl mb-2">💳</p>
                <p className="text-dark-300 text-sm font-medium">No payment records found</p>
                <p className="text-dark-500 text-xs mt-1">Try switching tabs or adjusting your search query</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {filteredPurchases.map((p) => {
                  const methodLabel = p.payment_method === 'bank_transfer'
                    ? '🏦 Bank / QR Pay'
                    : p.payment_method === 'binance_pay'
                      ? '🔶 Binance Pay'
                      : p.payment_method === 'bybit_pay'
                        ? '⚡ ByBit Pay'
                        : p.payment_method === 'admin_grant'
                          ? '👑 Admin Grant'
                          : p.payment_method || 'Direct Transfer';

                  const planLabel = p.type === 'full' ? '👑 Lifetime VIP' : '💜 1 Month VIP';

                  return (
                    <div
                      key={p.id}
                      className="p-4 sm:p-5 rounded-2xl bg-dark-900/80 border border-white/10 hover:border-white/20 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="flex items-start sm:items-center gap-4">
                        {/* Slip Thumbnail or Icon */}
                        {p.payment_proof_url ? (
                          <div
                            onClick={() =>
                              setViewingSlip({
                                id: p.id,
                                url: p.payment_proof_url || '',
                                email: p.profiles?.email || p.user_id,
                                name: p.profiles?.full_name,
                                method: methodLabel,
                                amount: p.amount,
                                status: p.status,
                                date: p.created_at,
                                type: planLabel,
                              })
                            }
                            className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-dark-800 border border-white/15 overflow-hidden flex-shrink-0 cursor-pointer group relative hover:scale-105 transition-transform"
                          >
                            {p.payment_proof_url.endsWith('.pdf') ? (
                              <div className="w-full h-full flex flex-col items-center justify-center bg-red-950/40 text-red-400 p-1 text-center">
                                <span className="text-xl">📄</span>
                                <span className="text-[9px] font-bold">PDF Slip</span>
                              </div>
                            ) : (
                              <img src={p.payment_proof_url} alt="Receipt Slip" className="w-full h-full object-cover" />
                            )}
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] font-bold text-white transition-opacity">
                              🔍 View Slip
                            </div>
                          </div>
                        ) : (
                          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-dark-800 border border-white/5 flex items-center justify-center text-dark-500 text-xs text-center p-2 flex-shrink-0">
                            No Slip
                          </div>
                        )}

                        {/* Details */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm sm:text-base font-bold text-white">
                              {p.profiles?.full_name || p.profiles?.email || p.user_id}
                            </span>
                            {p.profiles?.full_name && (
                              <span className="text-xs text-dark-400 font-mono">({p.profiles?.email})</span>
                            )}
                            {/* Status Pill */}
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${
                                p.status === 'verified'
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : p.status === 'rejected'
                                    ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                              }`}
                            >
                              {p.status === 'verified' ? '✅ Approved' : p.status === 'rejected' ? '❌ Rejected' : '⏳ Pending Review'}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-xs text-dark-300 flex-wrap">
                            <span className="font-semibold text-brand-400">{formatCurrency(p.amount || 350)}</span>
                            <span>•</span>
                            <span className="font-medium text-purple-300">{planLabel}</span>
                            <span>•</span>
                            <span className="text-dark-400">{methodLabel}</span>
                          </div>

                          <p className="text-[11px] text-dark-500">
                            Submitted: {p.created_at ? new Date(p.created_at).toLocaleString() : 'Recently'}
                          </p>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 flex-shrink-0 self-end md:self-center">
                        {p.payment_proof_url && (
                          <button
                            onClick={() =>
                              setViewingSlip({
                                id: p.id,
                                url: p.payment_proof_url || '',
                                email: p.profiles?.email || p.user_id,
                                name: p.profiles?.full_name,
                                method: methodLabel,
                                amount: p.amount,
                                status: p.status,
                                date: p.created_at,
                                type: planLabel,
                              })
                            }
                            className="px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-semibold hover:bg-white/20 transition-colors"
                          >
                            👁️ View Slip
                          </button>
                        )}

                        {p.status === 'pending' && (
                          <>
                            <button
                              onClick={() => verifyPayment(p.id, 'verified')}
                              disabled={actionLoading === `verify-${p.id}`}
                              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition-colors shadow-md shadow-emerald-600/20 disabled:opacity-50"
                            >
                              ✅ Approve &amp; Unlock VIP
                            </button>
                            <button
                              onClick={() => verifyPayment(p.id, 'rejected')}
                              disabled={actionLoading === `verify-${p.id}`}
                              className="px-3 py-2 rounded-xl bg-red-600/20 text-red-300 border border-red-500/30 text-xs font-bold hover:bg-red-600/30 transition-colors disabled:opacity-50"
                            >
                              ❌ Reject
                            </button>
                          </>
                        )}

                        {p.status === 'verified' && (
                          <button
                            onClick={() => verifyPayment(p.id, 'rejected')}
                            disabled={actionLoading === `verify-${p.id}`}
                            className="px-3 py-1.5 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50"
                          >
                            Revoke Approval
                          </button>
                        )}

                        {p.status === 'rejected' && (
                          <button
                            onClick={() => verifyPayment(p.id, 'verified')}
                            disabled={actionLoading === `verify-${p.id}`}
                            className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-medium hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                          >
                            Re-Approve
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* USERS TAB */}
        {tab === 'users' && (
          <div className="space-y-6 animate-fade-in">
            {/* Header & Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-dark-900/60 p-4 rounded-2xl border border-white/10">
              <div>
                <h3 className="text-base font-bold text-white">Registered Users ({users.length})</h3>
                <p className="text-xs text-dark-400 mt-0.5">Manage user roles, grant or revoke VIP access, and view user history</p>
              </div>
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search users by name or email..."
                className="w-full sm:w-72 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs placeholder-dark-500 focus:outline-none focus:border-brand-500"
              />
            </div>

            {usersLoading ? (
              <div className="py-12 flex justify-center">
                <LoadingSpinner text="Loading users list..." />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-16 rounded-2xl bg-dark-900/40 border border-white/5">
                <p className="text-3xl mb-2">👥</p>
                <p className="text-dark-300 text-sm font-medium">No users found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {filteredUsers.map((u) => {
                  const purchasesList = u.purchases || [];
                  const activeLifetime = purchasesList.find((p: any) => p.status === 'verified' && p.type === 'full');
                  const activeMonthly = purchasesList.find((p: any) => p.status === 'verified' && p.type === 'single');
                  const activeVIP = activeLifetime || activeMonthly;

                  const userRole = u.role || (u.is_admin ? 'admin' : 'user');

                  return (
                    <div
                      key={u.id}
                      className="p-4 sm:p-5 rounded-2xl bg-dark-900/80 border border-white/10 hover:border-white/20 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      {/* User Info */}
                      <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-brand-600 to-purple-600 text-white flex items-center justify-center font-bold text-lg shadow-md flex-shrink-0">
                          {(u.full_name || u.email || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-base font-bold text-white">{u.full_name || u.email}</span>
                            {u.full_name && (
                              <span className="text-xs text-dark-400 font-mono">({u.email})</span>
                            )}

                            {/* Staff Role Badge */}
                            {(u.is_admin || userRole === 'admin') ? (
                              <span className="px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30 text-[10px] font-bold">
                                🛡️ Admin
                              </span>
                            ) : userRole === 'editor' ? (
                              <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-bold">
                                ✍️ Editor
                              </span>
                            ) : userRole === 'moderator' ? (
                              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                                🛡️ Moderator
                              </span>
                            ) : null}

                            {/* VIP Status Pill */}
                            {activeLifetime ? (
                              <span className="px-2.5 py-0.5 rounded-full bg-gradient-to-r from-brand-600 to-amber-500 text-white text-[10px] font-extrabold tracking-wide uppercase shadow-sm">
                                👑 VIP Lifetime
                              </span>
                            ) : activeMonthly ? (
                              <span className="px-2.5 py-0.5 rounded-full bg-purple-600/30 text-purple-200 border border-purple-500/40 text-[10px] font-bold uppercase">
                                💜 VIP 1 Month
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full bg-white/5 text-dark-400 border border-white/5 text-[10px] font-medium">
                                👤 Free User
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-xs text-dark-400 flex-wrap">
                            <span>Registered: {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A'}</span>
                            <span>•</span>
                            <span>Slips Uploaded: {purchasesList.length}</span>
                          </div>
                        </div>
                      </div>

                      {/* User Actions */}
                      <div className="flex items-center gap-2 flex-wrap self-end md:self-center">
                        {/* Slips History Button */}
                        {purchasesList.length > 0 && (
                          <button
                            onClick={() => setSelectedUserSlips({ user: u, slips: purchasesList })}
                            className="px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-medium hover:bg-white/20 transition-colors"
                          >
                            🧾 Slips ({purchasesList.length})
                          </button>
                        )}

                        {/* Role Selector Dropdown */}
                        <select
                          value={userRole}
                          onChange={(e) => setUserRole(u.id, e.target.value as any)}
                          disabled={actionLoading === `role-${u.id}`}
                          className="px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-dark-200 font-medium focus:outline-none focus:border-brand-500 cursor-pointer"
                        >
                          <option value="user" className="bg-dark-900 text-white">Role: User</option>
                          <option value="moderator" className="bg-dark-900 text-white">Role: Moderator</option>
                          <option value="editor" className="bg-dark-900 text-white">Role: Editor</option>
                          <option value="admin" className="bg-dark-900 text-white">Role: Admin</option>
                        </select>

                        {/* Grant or Revoke VIP Buttons */}
                        {activeVIP ? (
                          <button
                            onClick={() => handleRevokeAccess(u.id, activeVIP.id)}
                            disabled={actionLoading === `revoke-${activeVIP.id}`}
                            className="px-3 py-1.5 rounded-xl bg-red-500/20 text-red-300 border border-red-500/30 text-xs font-bold hover:bg-red-500/30 transition-colors disabled:opacity-50"
                          >
                            ❌ Revoke VIP
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => handleGrantAccess(u.id, 'full')}
                              disabled={actionLoading === `grant-${u.id}`}
                              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-brand-600 to-amber-500 text-white text-xs font-bold hover:brightness-110 transition-all shadow-sm disabled:opacity-50"
                            >
                              👑 Grant Lifetime VIP
                            </button>
                            <button
                              onClick={() => handleGrantAccess(u.id, 'single')}
                              disabled={actionLoading === `grant-${u.id}`}
                              className="px-3 py-1.5 rounded-xl bg-purple-600/30 text-purple-200 border border-purple-500/30 text-xs font-semibold hover:bg-purple-600/40 transition-colors disabled:opacity-50"
                            >
                              💜 Grant 1 Month VIP
                            </button>
                          </>
                        )}

                        {/* Delete User Account Button */}
                        <button
                          onClick={() => handleDeleteUserAccount(u.id, u.email)}
                          disabled={actionLoading === `delete-user-${u.id}`}
                          className="p-1.5 rounded-xl bg-white/5 hover:bg-red-500/20 text-dark-400 hover:text-red-400 border border-white/5 transition-colors"
                          title="Delete User Account"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ===== PAYMENT RECEIPT SLIP PREVIEW MODAL ===== */}
        {viewingSlip && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setViewingSlip(null)} />
            <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto animate-scale-in rounded-2xl border border-white/10 bg-dark-900/95 backdrop-blur-xl shadow-2xl p-6">
              <button
                onClick={() => setViewingSlip(null)}
                className="absolute top-4 right-4 text-dark-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <h3 className="text-lg font-bold text-white mb-1">Payment Receipt Slip</h3>
              <p className="text-xs text-dark-400 mb-4">{viewingSlip.email} ({viewingSlip.method})</p>

              {/* Slip Image / PDF Preview */}
              <div className="bg-black/50 rounded-xl p-2 border border-white/10 mb-4 flex justify-center items-center min-h-[250px]">
                {viewingSlip.url.endsWith('.pdf') ? (
                  <div className="text-center py-8">
                    <span className="text-5xl block mb-2">📄</span>
                    <p className="text-sm font-bold text-white mb-3">PDF Receipt Document</p>
                    <a
                      href={viewingSlip.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-xl bg-brand-600 text-white text-xs font-bold hover:bg-brand-500 transition-colors inline-block"
                    >
                      Open PDF in New Window ↗
                    </a>
                  </div>
                ) : (
                  <img src={viewingSlip.url} alt="Receipt Slip" className="max-h-[60vh] max-w-full rounded-lg object-contain" />
                )}
              </div>

              {/* Slip Info Card */}
              <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1.5 text-xs mb-5">
                <div className="flex justify-between">
                  <span className="text-dark-400">User:</span>
                  <span className="font-semibold text-white">{viewingSlip.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-400">Amount:</span>
                  <span className="font-bold text-brand-400">{formatCurrency(viewingSlip.amount || 350)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-400">Method:</span>
                  <span className="text-white font-medium">{viewingSlip.method}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-400">Status:</span>
                  <span className={`font-bold uppercase ${viewingSlip.status === 'verified' ? 'text-emerald-400' : viewingSlip.status === 'rejected' ? 'text-red-400' : 'text-amber-400'}`}>
                    {viewingSlip.status}
                  </span>
                </div>
                {viewingSlip.date && (
                  <div className="flex justify-between">
                    <span className="text-dark-400">Submitted Date:</span>
                    <span className="text-dark-300">{new Date(viewingSlip.date).toLocaleString()}</span>
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              {viewingSlip.id && (
                <div className="flex gap-3">
                  <button
                    onClick={() => verifyPayment(viewingSlip.id!, 'verified')}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-500 transition-colors"
                  >
                    ✅ Approve &amp; Unlock VIP
                  </button>
                  <button
                    onClick={() => verifyPayment(viewingSlip.id!, 'rejected')}
                    className="flex-1 py-2.5 rounded-xl bg-red-600/20 text-red-300 border border-red-500/30 font-bold text-xs hover:bg-red-600/30 transition-colors"
                  >
                    ❌ Reject Slip
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== USER SLIPS HISTORY MODAL ===== */}
        {selectedUserSlips && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedUserSlips(null)} />
            <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-scale-in rounded-2xl border border-white/10 bg-dark-900/95 backdrop-blur-xl shadow-2xl p-6">
              <button
                onClick={() => setSelectedUserSlips(null)}
                className="absolute top-4 right-4 text-dark-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <h3 className="text-lg font-bold text-white mb-1">Payment History for {selectedUserSlips.user.email}</h3>
              <p className="text-xs text-dark-400 mb-6">Total Slips Uploaded: {selectedUserSlips.slips.length}</p>

              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                {selectedUserSlips.slips.map((p: any) => (
                  <div key={p.id} className="p-4 rounded-xl bg-dark-800/80 border border-white/10 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      {p.payment_proof_url ? (
                        <img
                          src={p.payment_proof_url}
                          alt="Slip"
                          onClick={() => setViewingSlip({ id: p.id, url: p.payment_proof_url || '', email: selectedUserSlips.user.email, method: p.payment_method, amount: p.amount, status: p.status, date: p.created_at })}
                          className="w-14 h-14 rounded-lg object-cover cursor-pointer hover:scale-105 transition-transform border border-white/10"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-dark-700 flex items-center justify-center text-[10px] text-dark-400">No Slip</div>
                      )}
                      <div>
                        <p className="text-xs font-bold text-white">{formatCurrency(p.amount || 350)} • {p.payment_method}</p>
                        <p className="text-[11px] text-dark-400">{new Date(p.created_at).toLocaleString()}</p>
                        <span className={`text-[10px] font-bold uppercase ${p.status === 'verified' ? 'text-emerald-400' : p.status === 'rejected' ? 'text-red-400' : 'text-amber-400'}`}>
                          ● {p.status}
                        </span>
                      </div>
                    </div>
                    {p.status === 'pending' && (
                      <div className="flex gap-2">
                        <button onClick={() => verifyPayment(p.id, 'verified')} className="px-3 py-1.5 rounded-lg text-xs bg-emerald-600 text-white font-bold">Approve</button>
                        <button onClick={() => verifyPayment(p.id, 'rejected')} className="px-3 py-1.5 rounded-lg text-xs bg-red-600/20 text-red-300 border border-red-500/30 font-bold">Reject</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
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
                        className="w-full flex items-center justify-between gap-3 p-3 rounded-lg hover:bg-white/5 text-left"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1" onClick={() => setSelectedTmdb(result)}>
                          {result.poster_path && (
                            <img src={`https://image.tmdb.org/t/p/w92${result.poster_path}`} alt="" className="w-10 h-14 rounded object-cover flex-shrink-0" />
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
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => setSelectedTmdb(result)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-brand-600 hover:bg-brand-500 text-white"
                          >
                            + Catalog
                          </button>
                          <button
                            onClick={() => handleImportTmdbToComingSoon(result)}
                            disabled={actionLoading === `cs-import-${result.id}`}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30"
                          >
                            ⏳ Coming Soon
                          </button>
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
