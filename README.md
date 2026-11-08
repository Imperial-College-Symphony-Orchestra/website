# ICSO Website, Updated 2026
The old Imperial College Symphony Orchestra ("ICSO") website ran on WordPress. While functional, this contained outdated information and was archaic in its design, featuring unclear subpage URLs and large blocks of text, rather than clear sections. As the elected web editor for the 2026/27 academic year, I was tasked with creating an updated website, fit for 2026 and better reflecting our unique position as Imperial's flagship orchestra since 1948.

This is a Node.js website that uses vanilla JavaScript animations, making for a lightweight but breathable and easily comprehensible site. Note that all of the information has been revamped for 2026, and the website features embedded media for to recent ICSO concert performances, as well as a clear page regarding the Auditions process. This is to ensure that prospective auditionees and ICSO members know our ethos and what to expect, just from spending a minute or two on the website.

Note that Render is being used as the website of choice for hosting.
If you are a web editor for ICSO for this year, then find all relevant information in the provided handover document.

## Running the site locally

In terminal of the working directory, run:
```
npm install
npm start
```
Then, go to a browser and open http://localhost:3000

## The website

As of August 2026, the current website URL is https://icso.uk/. Note that this may be subject to change in future years.

## Images

Pages use smaller WebP copies from `assets/webp/`, made from the originals in `assets/` (which are never changed). To add a photo or poster, put the original in `assets/`, reference it in the page as `/assets/your-file.jpg`, then run:
```
pip install pillow
python scripts/optimise_images.py --update-pages
```
This makes the WebP copy at the right size for how the page uses it and points the page at it. Commit both the page and the new file in `assets/webp/`.

## Concerts and ticket links

Anything that should disappear after a concert can carry the concert date, and the site removes it automatically from the next day (visitor's local time):
- On the Concerts page, put `data-until="YYYY-MM-DD"` on the element wrapping the Buy tickets button, e.g. `<div class="concert-tickets" data-until="2026-11-22">`.
- On the home page, give the concert's hero slide in `index.html` an `until:'YYYY-MM-DD'` field. The slide drops out of the carousel after that date.

When the next concert goes on the home page, also update the two `<link rel="preload">` lines at the top of `index.html` to its slide image and poster.
