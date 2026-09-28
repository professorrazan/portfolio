# Build brief: Razan Ahmad photography portfolio

Build a fast, static photography portfolio website for Razan Ahmad, a Melbourne-based portrait, graduation and event photographer. Plain HTML, CSS and vanilla JavaScript, no framework. It must deploy to Netlify as a static site. Ask me before adding any dependency beyond an image-processing tool.

## My files

- `design-reference/` — static HTML mockups of the approved design: `home-desktop.html`, `home-mobile.html`, `gallery-graduation.html` and `about-contact.html`. Open them in a browser (take screenshots if that helps you) and match their look closely: layout, spacing, type sizes, colours and copy. They use fixed pixel widths and grey placeholder boxes; the real site must be fully responsive and use my photos. Where the mockups and this brief disagree, follow this brief.
- `photos/<category-folder>/` — one folder per gallery (names below). The file named `cover.*` in each folder is that gallery's cover image; the rest are gallery images, shown in filename order.
- `video/banner.mp4` — the home page banner video.
- All photos, including my About photo, come from Lightroom via the API (see "Importing photos from Lightroom" below). I do not add photos by hand.

## Image and video processing

- Write a script (Node with `sharp`, or ImageMagick) that generates responsive WebP versions of every photo at 800, 1600 and 2400px on the long edge, plus a JPG fallback, into `site/img/`. Keep originals untouched.
- Generate a `galleries.json` data file from the folders so gallery pages are built from data, not hand-written.
- Compress the banner video to 1080p H.264 MP4, no audio track, ideally under 15 MB, and extract its first frame as a poster image. Use `ffmpeg` if available; ask me if not.

## Design

**Look:** quiet, gallery-like frame so the photos carry the colour. Generous whitespace, thin dividing lines, no shadows, no gradients except the scrim behind hero text.

**Colours (dark theme, default):**
background `#121110`, surface `#1B1917`, image placeholder `#2A2622`, lines `#2E2A26`, text `#EDE8E0`, muted text `#A8A095`, form field borders `#6A6259`.
**Accent:** `#E8618C`. Used only for filled buttons (with dark text `#141210`), the small dot on the graduation banner, and a 4px bottom strip on the Fashion/Concept Shoots cover.
Define all colours as CSS custom properties so a light theme can be added later (light: background `#F5F2ED`, surface `#ECE6DE`, text `#1A1816`, muted `#5E574F`).

**Type:** headings in Instrument Serif (Google Fonts, weight 400), everything else in Hanken Grotesk (400/500/600). Small labels are 13px uppercase with 0.12–0.18em letter-spacing. Large headings are tight (line-height ~1).

**Buttons:** pill-shaped (fully rounded), at least 44px tall. Primary = accent fill; secondary = 1px outline.

## Pages

### Header (all pages)
Name "Razan Ahmad" in the serif at left (links home). Right: Work, Graduation, Fashion/Concept, Events, About, and an accent "Book" pill. On mobile, collapse into a menu button with an accessible slide-down menu.

### Home (`index.html`)
1. **Banner video:** full-width, ~760px tall on desktop (about 75vh, min 520px), `autoplay muted loop playsinline` with the poster image. Dark gradient scrim at the bottom. Overlaid bottom-left: small label "Melbourne · Portrait, graduation & event photographer", big serif heading "Light, colour & the people in it.", then buttons "See the work" (scrolls to galleries) and "Book a session" (to contact). If `prefers-reduced-motion` is set, show the poster instead of playing the video.
2. **Selected work:** heading "Selected work" with a short line "Eight galleries, each led by its strongest frame." Then a 4-column grid (2 columns on tablet and mobile) of the 8 gallery covers, portrait 4:5 crop, with gallery name in the serif and a one-line description beneath.
3. **Graduation banner:** surface-coloured band: "Graduation season" label, heading "Graduating this December?", text "Campus and city sessions around Melbourne — solo, with family or with friends.", and a "Check availability" button to the contact form.
4. **About teaser:** my photo (4:5) beside "Hi, I'm Razan." and a short bio, with a "More about me →" link.
5. **Footer:** name, "Melbourne, Australia", Instagram and email links, © year.

### Galleries (one page per category, generated from `galleries.json`)
In this order:

| Folder | Title | Description |
|---|---|---|
| travel-portraits | Travel/Portraits | People and places on the road |
| graduation | Graduation | Individual, family & group sessions |
| events | Events | Celebrations, launches & parties |
| couple-group | Couple/Group | Couples, friends & families |
| fashion-concept | Fashion/Concept Shoots | RGB, gel & creative concepts |
| cars | Cars | Automotive & detail shots |
| architecture | Architecture | Buildings, lines & light |
| sports-events | Sports Events | Action on game day |

Layout: "← All work" link, huge serif title, one-line description on the right. Then a 3-column masonry layout that keeps each photo's natural aspect ratio (no cropping), 24px gaps; 2 columns on tablet, 1 on mobile. After every ~9 images, insert one full-width image to create rhythm. End with a "Next gallery" link (serif, large) to the next category, and a "Book a session" button.

Clicking any photo opens a keyboard-accessible lightbox (arrow keys, Esc to close, swipe on touch, focus trapped while open).

### About & Contact (`about.html`)
Two columns: my photo on the left; on the right the "About" label, "Hi, I'm Razan.", this bio:

> I'm a Melbourne-based photographer and computer science student at RMIT. I love portraits that feel personal, graduation photos that capture the milestone, and creative shoots where I get to play with light and colour.
>
> When I'm not behind the camera, I'm writing code — which probably explains why I'm obsessive about the details.

Then two small lists: "What I shoot" (the 8 categories) and "Gear" (Sony A6400, Tamron 17–70mm f/2.8, Sigma 56mm f/1.4, RGB video light).

Contact section (`#contact`), on the surface colour: heading "Let's make something great." with a short line, my email and Instagram, and a form with labelled fields: Name, Email, Type of shoot (dropdown of the 8 categories), Preferred date, Message, and a "Send enquiry" button. Submit to Formspree via fetch, with inline success and error messages; ask me for the Formspree endpoint.

## Quality requirements

- Lazy-load all images below the fold; use `srcset`/`sizes` with the generated WebP files.
- Every page gets a unique `<title>` (e.g. "Razan Ahmad | Melbourne Portrait & Graduation Photographer"), a meta description, and an Open Graph image (use the Travel/Portraits cover, not a car photo).
- Accessible: real links and buttons, visible focus styles, alt text on every image (derive from filenames and let me edit them in `galleries.json`), 4.5:1 text contrast.
- Lighthouse performance and accessibility scores of 90+ on mobile.

## Placeholders to ask me about

Email address, Instagram handle, Formspree endpoint, and domain name.

## Importing photos from Lightroom (cloud)

My photos are in Lightroom (the cloud version, not Classic). Instead of me exporting them by hand, build an import step:

- Write `scripts/import-lightroom.js` (Node) that uses the Adobe Lightroom Partner API to find my albums inside a Lightroom album folder named "Portfolio", whose album names match the 8 gallery titles above, plus a ninth album named "About".
- For each album, download the 2048px rendition of every photo into the matching `photos/<category-folder>/` folder, keeping the album's order. Save the album's cover photo as `cover.jpg`. From the "About" album, save its photo as `photos/about/me.jpg` for the About page and home page teaser. Also pull each photo's caption/title, if set, into `galleries.json` as its alt text.
- Authenticate with OAuth 2.0 through Adobe IMS: run a small local server for the one-time login, then store the refresh token so later runs don't need a login. Keep the client ID, client secret and tokens in a git-ignored `.env` file and never print them.
- Only download photos that are new or changed since the last run, and remove local files for photos I've taken out of an album. Back off and retry on 429/5xx responses.
- Add an `npm run import` command, and make `npm run build` run import → image processing → site build.
- Walk me through registering the app in the Adobe Developer Console first, and tell me exactly which settings and scopes to choose. If Adobe refuses access, fall back to my manually exported folders so the site still builds.

## Deployment

When the site works locally, walk me through deploying the `site/` folder to Netlify and connecting a custom domain.
