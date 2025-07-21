// Mock data for testing season selection feature
export const mockTvSeries = {
  id: 1396,
  name: "Breaking Bad",
  first_air_date: "2008-01-20",
  last_air_date: "2013-09-29",
  number_of_seasons: 5,
  number_of_episodes: 62,
  poster_path: "/ztkUQFLlC19CCMYHW9o1zWhJRNq.jpg",
  overview: "A high school chemistry teacher diagnosed with inoperable lung cancer turns to manufacturing and selling methamphetamine in order to secure his family's future.",
  media_type: "tv",
  seasons: [
    {
      id: 3577,
      season_number: 1,
      name: "Season 1",
      episode_count: 7,
      air_date: "2008-01-20",
      poster_path: "/spMOQ7jmWR30DybKOyLMO0gGYKC.jpg",
      overview: "High school chemistry teacher Walter White's life is suddenly transformed by a dire medical diagnosis."
    },
    {
      id: 3578,
      season_number: 2,
      name: "Season 2", 
      episode_count: 13,
      air_date: "2009-03-08",
      poster_path: "/spMOQ7jmWR30DybKOyLMO0gGYKC.jpg",
      overview: "Walt and Jesse attempt to tie up loose ends."
    },
    {
      id: 3579,
      season_number: 3,
      name: "Season 3",
      episode_count: 13, 
      air_date: "2010-03-21",
      poster_path: "/spMOQ7jmWR30DybKOyLMO0gGYKC.jpg",
      overview: "Walt continues to battle dueling identities: a desperate husband and father trying to provide for his family, and a newly minted drug dealer."
    },
    {
      id: 3580,
      season_number: 4,
      name: "Season 4",
      episode_count: 13,
      air_date: "2011-07-17", 
      poster_path: "/spMOQ7jmWR30DybKOyLMO0gGYKC.jpg",
      overview: "Walt and Jesse must cope with the fallout of their previous actions."
    },
    {
      id: 3581,
      season_number: 5,
      name: "Season 5",
      episode_count: 16,
      air_date: "2012-07-15",
      poster_path: "/spMOQ7jmWR30DybKOyLMO0gGYKC.jpg", 
      overview: "Walt is faced with the prospect of moving on in a world without his enemy."
    }
  ]
};

export const mockSearchResults = [
  mockTvSeries,
  {
    id: 550,
    title: "Fight Club",
    release_date: "1999-10-15",
    poster_path: "/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
    overview: "A ticking-time-bomb insomniac and a slippery soap salesman channel primal male aggression into a shocking new form of therapy.",
    media_type: "movie",
    director: "David Fincher",
    cast: ["Brad Pitt", "Edward Norton", "Helena Bonham Carter"],
    genres: ["Drama"]
  }
];

export const mockSeasonDetails = {
  1: {
    seasonDetails: {
      id: 3577,
      season_number: 1,
      name: "Season 1",
      episode_count: 7,
      air_date: "2008-01-20",
      overview: "High school chemistry teacher Walter White's life is suddenly transformed by a dire medical diagnosis.",
      episodes: [
        { id: 1, name: "Pilot", episode_number: 1, air_date: "2008-01-20" },
        { id: 2, name: "Cat's in the Bag...", episode_number: 2, air_date: "2008-01-27" },
        { id: 3, name: "...And the Bag's in the River", episode_number: 3, air_date: "2008-02-10" },
        { id: 4, name: "Cancer Man", episode_number: 4, air_date: "2008-02-17" },
        { id: 5, name: "Gray Matter", episode_number: 5, air_date: "2008-02-24" },
        { id: 6, name: "Crazy Handful of Nothin'", episode_number: 6, air_date: "2008-03-02" },
        { id: 7, name: "A No-Rough-Stuff-Type Deal", episode_number: 7, air_date: "2008-03-09" }
      ]
    },
    seasonCredits: {
      cast: [
        { id: 17419, name: "Bryan Cranston", character: "Walter White" },
        { id: 84497, name: "Aaron Paul", character: "Jesse Pinkman" },
        { id: 134531, name: "Anna Gunn", character: "Skyler White" }
      ],
      crew: [
        { id: 66633, name: "Vince Gilligan", job: "Creator" },
        { id: 29924, name: "Adam Bernstein", job: "Director" }
      ]
    }
  },
  2: {
    seasonDetails: {
      id: 3578,
      season_number: 2,
      name: "Season 2",
      episode_count: 13,
      air_date: "2009-03-08",
      overview: "Walt and Jesse attempt to tie up loose ends.",
      episodes: Array(13).fill(0).map((_, i) => ({
        id: i + 8,
        name: `Episode ${i + 1}`,
        episode_number: i + 1,
        air_date: "2009-03-08"
      }))
    },
    seasonCredits: {
      cast: [
        { id: 17419, name: "Bryan Cranston", character: "Walter White" },
        { id: 84497, name: "Aaron Paul", character: "Jesse Pinkman" },
        { id: 134531, name: "Anna Gunn", character: "Skyler White" }
      ],
      crew: [
        { id: 66633, name: "Vince Gilligan", job: "Creator" }
      ]
    }
  }
};