"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { getArtists } from "@/lib/api/artists";
import { GENRES } from "@/lib/constants";
import { Input } from "@/components/ui/Input";
import { ArtistCard } from "@/components/artist/ArtistCard";
import { cn } from "@/lib/utils";
import type { Artist } from "@/lib/types";

export default function ArtistsPage() {
  const [artists, setArtists] = React.useState<Artist[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [selectedGenres, setSelectedGenres] = React.useState<string[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const res = await getArtists({ limit: 100 });
      if (cancelled) return;
      setArtists(res.data);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const hasFilter = search.trim().length > 0 || selectedGenres.length > 0;

  // 前端内存过滤：搜索 trim + 多风格 OR
  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return artists.filter((a) => {
      if (q) {
        const hit =
          a.name.toLowerCase().includes(q) ||
          a.genres.some((g) => g.toLowerCase().includes(q));
        if (!hit) return false;
      }
      if (selectedGenres.length > 0) {
        if (!a.genres.some((g) => selectedGenres.includes(g))) return false;
      }
      return true;
    });
  }, [artists, search, selectedGenres]);

  const toggleGenre = (g: string) => {
    setSelectedGenres((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
    );
  };

  const clearFilters = () => {
    setSearch("");
    setSelectedGenres([]);
  };

  return (
    <main className="container-gigroom py-8 md:py-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-h1 mb-3 text-text-primary tracking-tight">
          发现乐队
        </h1>
        <p className="text-text-secondary text-body md:text-lg">
          找到你喜欢的声音，然后追上他们的下一场现场。
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-6 max-w-md">
        <Search
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none"
        />
        <Input
          type="text"
          placeholder="搜索乐队"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Genre Filter */}
      <div className="mb-8 flex flex-wrap items-center gap-2">
        {GENRES.map((g) => {
          const active = selectedGenres.includes(g);
          return (
            <button
              key={g}
              type="button"
              onClick={() => toggleGenre(g)}
              className={cn(
                "h-8 px-3 text-sm rounded-sm border transition-colors",
                active
                  ? "border-accent-lime bg-accent-lime/10 text-accent-lime"
                  : "border-border bg-bg-tertiary text-text-secondary hover:border-border-light hover:text-text-primary"
              )}
            >
              {g}
            </button>
          );
        })}
        {hasFilter && (
          <button
            type="button"
            onClick={clearFilters}
            className="h-8 px-3 text-sm rounded-sm text-text-tertiary hover:text-text-primary inline-flex items-center gap-1"
          >
            <X size={14} />
            清除筛选
          </button>
        )}
      </div>

      {/* Artist Grid */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square rounded-md bg-bg-secondary animate-pulse"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-12 text-center">
          <p className="text-text-secondary text-body mb-2">
            没有找到符合条件的乐队
          </p>
          <p className="text-text-tertiary text-sm mb-4">
            试试换个关键词或清除筛选。
          </p>
          <button
            type="button"
            onClick={clearFilters}
            className="text-sm text-accent-lime hover:text-accent-lime-hover"
          >
            清除筛选
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
          {filtered.map((artist) => (
            <ArtistCard key={artist.id} artist={artist} />
          ))}
        </div>
      )}
    </main>
  );
}
