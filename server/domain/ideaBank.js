// Built-in ideas, used when the AI service is unavailable or returns something unusable.
// The shape matches the validated AI output so the UI treats both the same way.

const BANK = Object.freeze({
  wedding: {
    themes: [
      { title: 'Royal heritage', description: 'Deep maroon and gold, brass lamps, marigold canopies and a dholi-and-shehnai welcome.' },
      { title: 'Pastel garden', description: 'Soft peach and sage with fresh flowers, fairy lights and an open-air mandap.' },
      { title: 'Rajasthani haveli', description: 'Block-print drapes, puppets, folk musicians and a mehfil-style seating corner.' },
      { title: 'Minimal and mindful', description: 'Seasonal flowers, banana-leaf motifs and a smaller, closer guest list.' },
    ],
    menu: {
      veg: ['Live chaat and dosa counters', 'Regional thali with dal baati or sarson ka saag', 'Paneer and seasonal vegetable mains', 'Kulfi and jalebi-rabri dessert station'],
      mixed: ['Live chaat counter', 'Tandoori starters (veg and non-veg)', 'Dal, biryani and a regional curry', 'Kulfi and gulab jamun dessert station'],
      jain: ['Jain chaat and pani puri counter', 'Moong dal, kadhi and seasonal vegetables without roots', 'Khichdi and puri-shrikhand thali', 'Fruit custard and halwa station'],
    },
    entertainment: ['Sangeet with family performances', 'Live dhol at the baraat', 'A DJ for the reception', 'A mehendi corner with a folk singer'],
    budgetTips: [
      'Choose seasonal flowers; imported blooms can double the decor bill.',
      'Fix the guest list before booking, since catering scales with headcount.',
      'Book outside peak muhurat dates for better vendor rates.',
      'Rent outfits for secondary functions instead of buying them.',
    ],
  },
  birthday: {
    themes: [
      { title: 'Favourite character', description: 'Pick one beloved character and build decor, cake and games around it.' },
      { title: 'Rooftop starlight', description: 'String lights, cushions, a popcorn bar and a projector for a movie night.' },
      { title: 'Colour burst', description: 'Balloon garlands in three bright colours with a matching dessert table.' },
      { title: 'Garden picnic', description: 'Floor seating, handmade bunting, lemonade stations and lawn games.' },
    ],
    menu: {
      veg: ['Mini pizzas and pasta cups', 'Paneer tikka skewers', 'Chaat and sliders', 'Cake, cupcakes and an ice-cream bar'],
      mixed: ['Chicken nuggets and mini burgers', 'Pasta and paneer tikka skewers', 'Chaat counter', 'Cake, cupcakes and an ice-cream bar'],
      jain: ['Jain pizza and pasta cups', 'Cutlets made with raw banana and potato', 'Dahi puri and sandwiches', 'Eggless cake and fruit custard'],
    },
    entertainment: ['A magician or puppet show for children', 'Treasure hunt and pass-the-parcel', 'A photo booth with props', 'A playlist voted by the guests'],
    budgetTips: [
      'Order the cake from a home baker to cut the cost significantly.',
      'Use balloons and lights; they give the most decor impact per rupee.',
      'Make return gifts useful, such as seed packets or stationery.',
    ],
  },
  public: {
    themes: [
      { title: 'Street food and music fair', description: 'Local food stalls, a main stage for bands and a craft lane for small sellers.' },
      { title: 'Cultural festival', description: 'Folk and classical performances across two stages with an art and heritage walk.' },
      { title: 'Startup and tech expo', description: 'Booths, short talks, a demo arena and a networking lounge.' },
      { title: 'Open-air concert night', description: 'One headline act with local openers, food trucks and a family zone.' },
    ],
    menu: {
      veg: ['Local chaat and snack stalls', 'Regional thali counter', 'Fresh juice and chaas stand', 'Dessert and kulfi cart'],
      mixed: ['Local chaat and grill stalls', 'Regional thali counter', 'Fresh juice and tea stand', 'Dessert and kulfi cart'],
      jain: ['Jain snack and chaat stall', 'Pure-vegetarian thali counter', 'Fresh juice stand', 'Dessert cart without onion or garlic'],
    },
    entertainment: ['A headline performance', 'Local bands and dance troupes', 'Kids and family activity zone', 'A photo wall and selfie points', 'Compere-led contests and giveaways'],
    budgetTips: [
      'Sell stall space and sponsor banners to cover the stage and sound costs.',
      'Use early-bird tickets to estimate turnout and book vendors with confidence.',
      'Ask the venue about a bundled power, security and cleaning package.',
    ],
  },
  community: {
    themes: [
      { title: 'Cultural evening', description: 'Folk performances, local artists and a stall area for neighbourhood crafts.' },
      { title: 'Festival fair', description: 'Food stalls, games and a children’s corner with a shared community lunch.' },
      { title: 'Service day', description: 'Pair a celebration with a blood-donation or health-check camp.' },
      { title: 'Open-air bhajan sandhya', description: 'Music, lamps and a simple prasad for everyone attending.' },
    ],
    menu: {
      veg: ['Community khichdi and kadhi', 'Puri-sabzi with halwa', 'Fruit and chaas counter'],
      mixed: ['Community khichdi and kadhi', 'Puri-sabzi with halwa', 'Tea, snacks and chaas'],
      jain: ['Moong dal khichdi and kadhi without roots', 'Puri with seasonal vegetables', 'Fruit and chaas counter'],
    },
    entertainment: ['Local school performances', 'A quiz or antakshari round', 'Open mic for residents', 'Traditional games for children'],
    budgetTips: [
      'Ask local businesses to sponsor stalls or refreshments in return for a banner.',
      'Recruit volunteers early; they replace the largest labour cost.',
      'Use a school or community ground to avoid venue rent.',
    ],
  },
});

const FALLBACK_PERSONAL_TOUCH = 'Add one personal ritual or story that reflects your family; guests remember this most.';

/** Returns ideas for the event in the same shape as validated AI output. */
export function fallbackIdeas({ eventType, dietary, guests }) {
  const bank = BANK[eventType];
  const entertainment = guests > 150 ? bank.entertainment : bank.entertainment.slice(0, 3);
  return {
    themes: bank.themes.slice(0, 3),
    menu: bank.menu[dietary] ?? bank.menu.mixed,
    entertainment,
    budgetTips: bank.budgetTips,
    personalTouch: FALLBACK_PERSONAL_TOUCH,
  };
}
