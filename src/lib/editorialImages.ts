// Editorial images for the events list — wide atmospheric photos used as
// visual breaks between groups of event listings. These are NOT tied to
// Google Calendar and never affect filtering, sorting, or which events are
// "featured." Add, remove, or reorder entries in this array freely.
//
// beforeEventTitle: the image renders immediately before the standalone
// event or series whose title/name matches this string exactly (case-
// sensitive) — right below the divider line, directly above that event's
// title, so it reads as belonging with the event that follows it. If that
// event later expires and drops off the site, the image simply stops
// appearing too — nothing else to clean up.
//
// position (optional): controls which part of the photo stays visible
// when it's cropped to fit the wide desktop shape and the taller mobile
// shape. Defaults to "center" if left out. Use a keyword pair like
// "center top", "center bottom", "left center" — or a percentage pair
// like "50% 20%" for finer control. Handy when the interesting part of
// a photo isn't dead-center (a sky-heavy shot might want "center 70%"
// to keep the ground in frame on the taller mobile crop, for example).
//
// Add real images to /public/images/editorial/ and reference them here
// with a path like "/images/editorial/your-file.jpg".

export interface EditorialImage {
  src: string;
  alt: string;
  caption?: string;
  beforeEventTitle: string;
  position?: string;
}

// The hero image: one wide photo at the top of the page, under the heading
// and intro, that sets the mood for the whole page. It isn't attached to any
// event, so it always shows no matter which filters are on. Leave it as
// `undefined` to show no hero image. It takes the same fields as an entry
// below, minus beforeEventTitle (`caption` and `position` are optional).
//
// Example:
//
// export const heroImage: HeroImage | undefined = {
//   src: "/images/editorial/halloween-ghosts-lights.webp",
//   alt: "Autumn leaves along a downtown Indianapolis canal walk",
//   position: "center 40%",
// };

export type HeroImage = Omit<EditorialImage, "beforeEventTitle">;

export const heroImage: HeroImage | undefined = {
  src: "/images/editorial/halloween-ghosts-lights.webp",
  alt: "Small, friendly glowing ghost figures light up a dark background decorated with warm orange and red bokeh lights.",
  position: "center 40%",
};

export const editorialImages: EditorialImage[] = [
  // Example — copy this shape, fill in your own image/alt/caption, then
  // set beforeEventTitle to the exact title of the event you want it to
  // introduce:
  //
  // {
  //   src: "/images/editorial/fall-pumpkins.jpg",
  //   alt: "A row of orange pumpkins at an outdoor fall market",
  //   caption: "Fall events around Indianapolis",
  //   beforeEventTitle: "ZooBoo",
  //   position: "center 30%",
  // },
  {
    src: "/images/editorial/indy-fright-academy-haunted-house.webp",
    alt: "Silhouette illustration of a spooky haunted house and cemetery under a glowing full moon.",
    caption: "A glowing full moon, haunted house and jack-o’-lanterns set the scene for Fright Academy’s Halloween attractions.",
    beforeEventTitle: "Fright Academy Haunted House",
    position: "center 50%",
  },
  {
    src: "/images/editorial/indy-carmel-christkindlmarkt.webp",
    alt: "Star-shaped holiday lights glow above blurred outdoor market stalls and pedestrians at night.",
    caption: "Star-shaped holiday lights illuminate an outdoor winter market setting at night.",
    beforeEventTitle: "Carmel Christkindlmarkt",
    position: "center 10%",
  },
  {
    src: "/images/editorial/indy-the-lion-king-in-concert.webp",
    alt: "Close-up of musicians playing violins during a live orchestra performance.",
    caption: "Violinists perform together as part of a live symphony orchestra.",
    beforeEventTitle: "Disney's The Lion King: Live in Concert",
    position: "center 50%",
  },
];
