import AuthenticatingConcept from "./concepts/authenticating";
import FavoritingConcept from "./concepts/favoriting";
import FilteringConcept from "./concepts/filtering";
import FriendingConcept from "./concepts/friending";
import PostingConcept from "./concepts/posting";
import SessioningConcept from "./concepts/sessioning";

// The app is a composition of concepts instantiated here
// and synchronized together in `routes.ts`.
export const Sessioning = new SessioningConcept();
export const Authing = new AuthenticatingConcept("users");
export const Posting = new PostingConcept("posts");
export const Friending = new FriendingConcept("friends");
export const Favoriting = new FavoritingConcept("favorites");
export const Filtering = new FilteringConcept("filters");
