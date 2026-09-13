// Editorial images for the /events/ page — wide atmospheric photos used as
// visual breaks between groups of event listings. These are NOT tied to
// Google Calendar and never affect filtering, sorting, or which events are
// "featured." Add, remove, or reorder entries in this array freely.
//
// afterEventTitle: the image renders immediately after the standalone
// event or series whose title/name matches this string exactly (case-
// sensitive). If that event later expires and drops off the site, the
// image simply stops appearing too — nothing else to clean up.
//
// Add real images to /public/images/editorial/ and reference them here
// with a path like "/images/editorial/your-file.jpg".

export interface EditorialImage {
  src: string;
  alt: string;
  caption?: string;
  afterEventTitle: string;
}

export const editorialImages: EditorialImage[] = [
  // Example — copy this shape, fill in your own image/alt/caption, then
  // set afterEventTitle to the exact title of the event you want it to
  // follow:
  //
  // {
  //   src: "/images/editorial/fall-pumpkins.jpg",
  //   alt: "A row of orange pumpkins at an outdoor fall market",
  //   caption: "Fall events around Indianapolis",
  //   afterEventTitle: "ZooBoo",
  // },
];
