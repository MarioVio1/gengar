# Gengar Discovery ITA - Stremio Addon

Addon Stremio con cataloghi TMDB in italiano per Film, Serie TV e Anime.

## Caratteristiche

- 🎬 **Film** - Trending, Top Rated, per Genere, per Decennio, Hidden Gems
- 📺 **Serie TV** - Netflix, HBO, Disney+, Apple TV+, K-Drama
- 🎌 **Anime** - Trending, Top, per Genere, in Corso, Film Anime
- 🎲 **Random Night** - Selezione casuale che cambia ogni notte
- 🎨 **ERDB Support** - Poster personalizzati con ratings

## Deploy su Vercel

1. Fork/Clone questo repository
2. Vai su [vercel.com](https://vercel.com)
3. Clicca "New Project"
4. Importa il repository
5. Clicca "Deploy"

## Utilizzo in Stremio

1. Apri l'app deployata su Vercel
2. Configura il tuo addon (tipo contenuto, cataloghi, ecc.)
3. Copia l'URL del manifest
4. In Stremio, vai su "Addons" → "Install addon"
5. Incolla l'URL e conferma

## Sviluppo Locale

```bash
# Installa dipendenze
bun install

# Avvia server di sviluppo
bun run dev

# Build per produzione
bun run build
```

## Configurazione

- **Tipo Contenuto**: Movie, Series, Anime, o tutti
- **Shuffle**: Mescola i risultati in modo casuale
- **ERDB**: Inserisci la config string per poster personalizzati
- **TopStreaming**: Inserisci la API key per link streaming

## License

MIT
