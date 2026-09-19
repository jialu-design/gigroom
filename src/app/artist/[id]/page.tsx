import { notFound } from "next/navigation";
import { getArtistById } from "@/lib/api/artists";
import { getShowsByArtist } from "@/lib/api/shows";
import { ArtistHeader } from "@/components/artist/ArtistHeader";
import { ArtistShows } from "@/components/artist/ArtistShows";

interface ArtistDetailPageProps {
  params: { id: string };
}

export default async function ArtistDetailPage({
  params,
}: ArtistDetailPageProps) {
  const artist = await getArtistById(params.id);
  if (!artist) {
    notFound();
  }

  const shows = await getShowsByArtist(params.id);

  return (
    <main className="container-gigroom py-8 md:py-12">
      <ArtistHeader artist={artist} />
      <ArtistShows shows={shows} />
    </main>
  );
}
