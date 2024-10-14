import { ObjectId } from "mongodb";

import { Router, getExpressRouter } from "./framework/router";

import { Authing, Favoriting, Filtering, Posting, Remixing, Sessioning } from "./app";
import { PostOptions } from "./concepts/posting";
import { SessionDoc } from "./concepts/sessioning";
import Responses from "./responses";

import { z } from "zod";

/**
 * Web server routes for the app. Implements synchronizations between concepts.
 */
class Routes {
  // Synchronize the concepts from `app.ts`.

  @Router.get("/session")
  async getSessionUser(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    return await Authing.getUserById(user);
  }

  @Router.get("/users")
  async getUsers() {
    return await Authing.getUsers();
  }

  @Router.get("/users/:username")
  @Router.validate(z.object({ username: z.string().min(1) }))
  async getUser(username: string) {
    return await Authing.getUserByUsername(username);
  }

  @Router.post("/users")
  async createUser(session: SessionDoc, username: string, password: string) {
    Sessioning.isLoggedOut(session);
    return await Authing.create(username, password);
  }

  @Router.patch("/users/username")
  async updateUsername(session: SessionDoc, username: string) {
    const user = Sessioning.getUser(session);
    return await Authing.updateUsername(user, username);
  }

  @Router.patch("/users/password")
  async updatePassword(session: SessionDoc, currentPassword: string, newPassword: string) {
    const user = Sessioning.getUser(session);
    return Authing.updatePassword(user, currentPassword, newPassword);
  }

  @Router.delete("/users")
  async deleteUser(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    Sessioning.end(session);
    return await Authing.delete(user);
  }

  @Router.post("/login")
  async logIn(session: SessionDoc, username: string, password: string) {
    const u = await Authing.authenticate(username, password);
    Sessioning.start(session, u._id);
    return { msg: "Logged in!" };
  }

  @Router.post("/logout")
  async logOut(session: SessionDoc) {
    Sessioning.end(session);
    return { msg: "Logged out!" };
  }

  @Router.get("/posts")
  @Router.validate(z.object({ author: z.string().optional() }))
  async getPosts(author?: string) {
    let posts;
    if (author) {
      const id = (await Authing.getUserByUsername(author))._id;
      posts = await Posting.getByAuthor(id);
    } else {
      posts = await Posting.getPosts();
    }
    return Responses.posts(posts);
  }

  /**
   * @param title The title or prefix to search by
   * @returns The set of posts that match the search
   */
  @Router.get("/posts/:title")
  async searchPosts(title: string) {
    const searchingByTitle = await Posting.getByTitle(title);
    return Responses.posts(searchingByTitle);
  }

  @Router.post("/posts")
  async createPost(session: SessionDoc, videoURL: string, videoTitle: string, videoDescription: string, originalArtist?: string, options?: PostOptions) {
    const user = Sessioning.getUser(session);
    const created = await Posting.create(user, videoURL, videoTitle, videoDescription, originalArtist, options);
    return { msg: created.msg, post: await Responses.post(created.post) };
  }

  @Router.delete("/posts/:id")
  async deletePost(session: SessionDoc, id: string) {
    const user = Sessioning.getUser(session);
    const oid = new ObjectId(id);
    await Posting.assertAuthorIsUser(oid, user);
    await Remixing.deleteRemix(oid);
    await Filtering.deletePostStorage(oid);
    return Posting.delete(oid);
  }

  /* FRIEND ROUTES (not being used in my project)
  @Router.get("/friends")
  async getFriends(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    return await Authing.idsToUsernames(await Friending.getFriends(user));
  }

  @Router.delete("/friends/:friend")
  async removeFriend(session: SessionDoc, friend: string) {
    const user = Sessioning.getUser(session);
    const friendOid = (await Authing.getUserByUsername(friend))._id;
    return await Friending.removeFriend(user, friendOid);
  }

  @Router.get("/friend/requests")
  async getRequests(session: SessionDoc) {
    const user = Sessioning.getUser(session);
    return await Responses.friendRequests(await Friending.getRequests(user));
  }

  @Router.post("/friend/requests/:to")
  async sendFriendRequest(session: SessionDoc, to: string) {
    const user = Sessioning.getUser(session);
    const toOid = (await Authing.getUserByUsername(to))._id;
    return await Friending.sendRequest(user, toOid);
  }

  @Router.delete("/friend/requests/:to")
  async removeFriendRequest(session: SessionDoc, to: string) {
    const user = Sessioning.getUser(session);
    const toOid = (await Authing.getUserByUsername(to))._id;
    return await Friending.removeRequest(user, toOid);
  }

  @Router.put("/friend/accept/:from")
  async acceptFriendRequest(session: SessionDoc, from: string) {
    const user = Sessioning.getUser(session);
    const fromOid = (await Authing.getUserByUsername(from))._id;
    return await Friending.acceptRequest(fromOid, user);
  }

  @Router.put("/friend/reject/:from")
  async rejectFriendRequest(session: SessionDoc, from: string) {
    const user = Sessioning.getUser(session);
    const fromOid = (await Authing.getUserByUsername(from))._id;
    return await Friending.rejectRequest(fromOid, user);
  }
    */

  // Favoriting Routes

  /**
   * @param userID The ID of a user object to check the favorited posts for
   * @returns A list of the posts favorited by that user
   */
  @Router.get("/favoriting/getFavorites/:userID")
  async getFavoritesByUser(userID: string) {
    const actualID = new ObjectId(userID);
    const favoritedIDs = await Favoriting.getFavoritedByUser(actualID);
    const result = await Posting.getByID(favoritedIDs);
    return result;
  }

  /**
   * Toggles the favorite on or off for some post (by the current session user)
   *
   * @param postID The ID of the post to favorite/unfavorite
   * @param session The current session the user is in
   * @returns a message about whether the user unfavorited or favorited the post
   */
  @Router.post("/favoriting/toggleFavorite/:postID")
  async toggleFavorite(postID: string, session: SessionDoc) {
    Sessioning.isLoggedIn(session);
    const oid = new ObjectId(postID);
    Posting.assertPostExists(oid);

    const user = Sessioning.getUser(session);
    const result = await Favoriting.toggleFavorite(user, oid);
    return { msg: "Toggled Favorite: " + result };
  }

  /**
   * @param postID The ID of some post to check the number of favorites on
   * @returns The number of favorites on the post
   */
  @Router.get("/favoriting/favoriteCount/:postID")
  async getFavoriteCount(postID: string) {
    const oid = new ObjectId(postID);
    Posting.assertPostExists(oid);
    const result = await Favoriting.getFavoriteCount(oid);
    return { msg: "Favorite Count: " + result };
  }

  /**
   * @param numPosts The number of trending posts to get
   * @returns A list of recent posts that have the most favorites (of size numPosts)
   */
  @Router.get("/favoriting/getTrendingFavorited/:numPosts")
  async getTrendingFavorited(numPosts: number) {
    // returns "numPosts" number of recent posts that are getting the most favorites
    const WITHIN_NUM_DAYS = 3;
    const recent_posts = await Posting.getRecentPosts(WITHIN_NUM_DAYS);
    const oids = [];
    for (let i = 0; i < recent_posts.length; i++) {
      oids.push(recent_posts[i]._id);
    }
    const result = await Favoriting.getMostFavorited(oids, numPosts);

    if (!result) throw new Error("Could not get posts for found trending favorited posts.");
    const resultAsPosts = await Posting.getByID(result);

    return Responses.posts(resultAsPosts);
  }

  // Filtering Routes

  /**
   * @param postID The ID of a post to get the tags for
   * @returns A list of the tags on a particular post (as indices)
   */
  @Router.get("/filtering/getTags/:postID")
  async getTagsOnPost(postID: string) {
    const oid = new ObjectId(postID);
    Posting.assertPostExists(oid);
    return await Filtering.getTagsOnPost(oid);
  }

  /**
   * Adds a tag to a post (if the tag name is within the defined valid set)
   * @param postID the id of the post to add a tag to
   * @param tagName the name of the tag to add
   * @returns a message about whether the addition was successful
   */
  @Router.post("/filtering/addTag/:postID")
  async addTagToPost(postID: string, tagName: string) {
    const oid = new ObjectId(postID);
    Posting.assertPostExists(oid);
    return await Filtering.addTag(oid, tagName);
  }

  /**
   * Removes one specific tag from a post (if it exists on the post, otherwise does nothing)
   * @param postID the id of the post with a tag to remove
   * @param tagName the name of the tag to remove
   * @returns a message about whether or not the action was successful
   */
  @Router.post("/filtering/removeTag/:postID")
  async removeTagFromPost(postID: string, tagName: string) {
    const oid = new ObjectId(postID);
    Posting.assertPostExists(oid);
    return await Filtering.removeTag(oid, tagName);
  }

  /**
   * @param tagNames a list of tags to check, separated by comma (whitespace ignored)
   * @returns the set of all posts where each post in the set has all of the tags in 'tagNames'
   */
  @Router.get("/filtering/getPostsByTag")
  async getPostsByTag(tagNames: string) {
    return await Filtering.getPostsByTags(tagNames);
  }

  /**
   * @param tagNames a list of tags to check, separated by comma (whitespace ignored)
   * @returns a random post within the set of all posts that have all of the tags in 'tagNames'
   */
  @Router.get("/filtering/getRandomPostFiltered")
  async getRandomPostFiltered(tagNames: string) {
    let allPosts = [];
    if (tagNames == null) {
      allPosts = await Posting.getPosts();
    } else {
      const allPostIDs = await Filtering.getPostsByTags(tagNames);
      if (allPostIDs.length == 0) {
        return [];
      }
      allPosts = await Posting.getByID(allPostIDs);
    }
    const randomIdx = Math.floor(Math.random() * allPosts.length);
    return Responses.posts([allPosts[randomIdx]]);
  }

  // Remixing Routes

  /**
   * @param postID the id of a post to get the remixes for
   * @returns a list of all the remixes on the post with id 'postID'
   */
  @Router.get("/remixing/getRemixes/:postID")
  async getPostRemixes(postID: string) {
    // assert postID is an existing post (using posting concept)
    const oid = new ObjectId(postID);
    Posting.assertPostExists(oid);
    // use remixing concept to get postIDs of remixes from the request on this original postID
    const remixes = await Remixing.getRemixesOnPost(oid);
    // use posting concept to get the posts from these ids
    const result = await Posting.getByID(remixes);
    return Responses.posts(result);
  }

  /**
   * @param postID the id of a post to count the number of favorites for
   * @returns the total count of the number of remixes the post with id 'postID' has
   */
  @Router.get("/remixing/getNumRemixed/:postID")
  async getNumRemixes(postID: string) {
    // assert postID is an existing post (using posting concept)
    const oid = new ObjectId(postID);
    Posting.assertPostExists(oid);
    // use remixing concept to get postIDs of remixes from the request on this original postID
    const remixes = await Remixing.getRemixesOnPost(oid);
    return remixes.length;
  }

  /**
   * Creates a new post as a remix of the post with id 'originalPostID', and info from the following fields, with 'originalArtist' automatically updating from the original post
   * @param originalPostID the original post this is a remix of
   * @param session the current session the user is in
   * @param videoURL the url of the video content in the post
   * @param videoTitle the title of the post
   * @param videoDescription a text description of the post (about/resources)
   * @param originalArtist the original artist of the post
   * @param options additional options for modifying the post
   * @returns the newly created post
   */
  @Router.post("/remixing/createRemix")
  async createRemix(originalPostID: string, session: SessionDoc, videoURL: string, videoTitle: string, videoDescription: string, originalArtist?: string, options?: PostOptions) {
    // assert that the original post exists
    const oid = new ObjectId(originalPostID);
    Posting.assertPostExists(oid);
    const originalPost = (await Posting.getByID([oid]))[0];
    const foundArtist = originalPost.originalArtist;
    // assert that the user is logged in
    Sessioning.isLoggedIn(session);
    const user = Sessioning.getUser(session);
    const created = await Posting.create(user, videoURL, videoTitle, videoDescription, foundArtist, options);
    if (!created.post) throw new Error("Could not create post as a remix.");
    await Remixing.createRemix(new ObjectId(originalPostID), created.post._id);
    return { msg: "Created as a remix: " + created.msg, post: await Responses.post(created.post) };
  }

  /**
   * @param numPosts The number of trending posts to get
   * @returns A list of recent posts that have the most remixes (of size numPosts)
   */
  @Router.get("/remixing/getTrendingRemixed/:numPosts")
  async getTrendingRemixed(numPosts: number) {
    console.log("getting trending remixed posts...");
    // returns "numPosts" number of recent posts that are getting the most remixes
    const WITHIN_NUM_DAYS = 3;
    const recent_posts = await Posting.getRecentPosts(WITHIN_NUM_DAYS);
    console.log("got recent posts");
    const oids = [];
    for (let i = 0; i < recent_posts.length; i++) {
      oids.push(recent_posts[i]._id);
    }
    console.log("getting remixes on posts...");
    const result = await Remixing.getMostRemixed(oids, numPosts);
    console.log("done!");

    if (!result) throw new Error("Could not get remixes for found trending remixed posts.");
    const resultAsPosts = await Posting.getByID(result);

    return Responses.posts(resultAsPosts);
  }

  /**
   * @param postID the id of the post to get it's original "root" post for
   * @returns the post that this post is a remix of, or nothing if the original post was deleted, or this post was not a remix.
   */
  @Router.get("/remixing/getOriginalPost/:postID")
  async getOriginalPost(postID: string) {
    // given some post id, returns the original post if it is a remix, or null if it's not a remix
    const oid = new ObjectId(postID);
    Posting.assertPostExists(oid);
    const resultID = await Remixing.getOriginalPost(oid);
    if (!resultID) return { msg: "Could not get the original post, either this post is not a remix, or the original post was deleted.", post: null };
    const postResult = await Posting.getByID([resultID]);
    return { msg: "Found original post.", post: Responses.posts(postResult) };
  }
}

/** The web app. */
export const app = new Routes();

/** The Express router. */
export const appRouter = getExpressRouter(app);
