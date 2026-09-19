const express = require('express');
const compression = require('compression');
const path = require('path');

const app = express();
app.use(compression());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

const founded = 1948;

function base(page, title, description) {
  return { page, title, description, icsoYears: new Date().getFullYear() - founded };
}

app.get('/', (req, res) => {
  res.render('home', base('home',
    'Imperial College Symphony Orchestra - Entertaining the masses since 1948',
    "ICSO is Imperial College London's flagship orchestra: 80 players, an 78-year history, and a season of concerts across London."));
});

app.get('/about', (req, res) => {
  res.render('about', base('about',
    'About - Imperial College Symphony Orchestra',
    "ICSO's history since 1948 and conductor Oliver Gooch."));
});

app.get('/join', (req, res) => {
  res.render('join', base('join',
    'Join - Imperial College Symphony Orchestra',
    'How to audition for ICSO: sections, audition format and term dates.'));
});

app.get('/support', (req, res) => {
  res.render('support', base('support',
    'Support - Imperial College Symphony Orchestra',
    "Support ICSO's concerts, tours and outreach as a Friend, donor or corporate sponsor."));
});

app.get('/contact', (req, res) => {
  res.render('contact', base('contact',
    'Contact - Imperial College Symphony Orchestra',
    'Get in touch with the ICSO committee.'));
});

app.get('/concerts', (req, res) => {
  res.render('concerts', base('concerts',
    'Concerts - Imperial College Symphony Orchestra',
    'Upcoming ICSO concerts, full programme and performer details, plus an archive of past seasons.'));
});

app.get('/gallery', (req, res) => {
  res.render('gallery', base('gallery',
    'Gallery - Imperial College Symphony Orchestra',
    'Photos from ICSO: concerts, rehearsals, tours, socials, and events.'));
});

app.get('/committee', (req, res) => {
  res.render('committee', base('committee',
    'Committee - Imperial College Symphony Orchestra',
    'Meet the elected ICSO committee.'));
});

app.use((req, res) => {
  res.status(404).send('Page not found');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`ICSO site running at http://localhost:${PORT}`));
