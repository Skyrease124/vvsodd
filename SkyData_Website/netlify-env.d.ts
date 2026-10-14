// Set to 1 by the Netlify build (netlify-adapter/README.md); unset for ChatGPT Sites / Cloudflare.
interface ImportMetaEnv {
  readonly VITE_SKYDATA_NETLIFY?: string;
}
