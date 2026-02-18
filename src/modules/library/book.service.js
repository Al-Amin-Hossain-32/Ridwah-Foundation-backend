import {cloudinary} from "../../config/cloudinary.js";
import Book from "./book.model.js";
import BookRequest from "./bookRequest.model.js";

// ─── Helper: Cloudinary Upload from Buffer ────────────────────────────────────
const uploadToCloudinary = (buffer, options) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
    stream.end(buffer);
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// BOOK CRUD
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Create Book ──────────────────────────────────────────────────────────────
export const createBook = async (bookData, userId) => {
  const {
    title,
    author,
    description,
    genre,
    language,
    publishedYear,
    publisher,
    bookType,
    physical,
    digital,
    borrowDurationDays,
  } = bookData;

  // physical বইয়ে availableCopies default = totalCopies
  const physicalData = physical || {};
  if (
    (bookType === "physical" || bookType === "hybrid") &&
    physicalData.totalCopies !== undefined &&
    physicalData.availableCopies === undefined
  ) {
    physicalData.availableCopies = physicalData.totalCopies;
  }

  const book = await Book.create({
    title,
    author,
    description,
    genre: genre || [],
    language,
    publishedYear,
    publisher,
    bookType,
    physical: physicalData,
    digital: digital || {},
    borrowDurationDays,
    addedBy: userId,
  });

  return book;
};

// ─── Get All Books (Search + Filter + Paginate) ───────────────────────────────
export const getAllBooks = async (query) => {
  const {
    search,
    genre,
    language,
    bookType,
    isAvailable,
    sortBy = "newest",
    page = 1,
    limit = 10,
  } = query;

  const filter = { isActive: true };

  // Full-text search
  if (search) {
    filter.$text = { $search: search };
  }

  // Filters
  if (genre) filter.genre = { $in: Array.isArray(genre) ? genre : [genre] };
  if (language) filter.language = language;
  if (bookType) filter.bookType = bookType;

  // isAvailable → physical.availableCopies > 0 অথবা digital
  if (isAvailable === "true") {
    filter.$or = [
      { bookType: "digital" },
      { "physical.availableCopies": { $gt: 0 } },
    ];
  }

  // Sort
  const sortOptions = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    rating: { averageRating: -1 },
    title: { title: 1 },
  };
  const sort = sortOptions[sortBy] || sortOptions.newest;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [books, total] = await Promise.all([
    Book.find(filter)
      .populate("addedBy", "name avatar")
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean({ virtuals: true }),
    Book.countDocuments(filter),
  ]);

  return {
    books,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
    },
  };
};

// ─── Get Book By ID ───────────────────────────────────────────────────────────
export const getBookById = async (bookId) => {
  const book = await Book.findById(bookId)
    .populate("addedBy", "name avatar")
    .populate("reviews.user", "name avatar")
    .lean({ virtuals: true });

  if (!book) {
    const err = new Error("Book not found");
    err.statusCode = 404;
    throw err;
  }

  return book;
};

// ─── Update Book ──────────────────────────────────────────────────────────────
export const updateBook = async (bookId, updateData) => {
  const book = await Book.findById(bookId);
  if (!book) {
    const err = new Error("Book not found");
    err.statusCode = 404;
    throw err;
  }

  const allowedFields = [
    "title",
    "author",
    "description",
    "genre",
    "language",
    "publishedYear",
    "publisher",
    "bookType",
    "borrowDurationDays",
    "isActive",
  ];

  allowedFields.forEach((field) => {
    if (updateData[field] !== undefined) {
      book[field] = updateData[field];
    }
  });

  // Nested physical / digital update
  if (updateData.physical) {
    Object.assign(book.physical, updateData.physical);
  }
  if (updateData.digital) {
    Object.assign(book.digital, updateData.digital);
  }

  await book.save();
  return book;
};

// ─── Delete Book ──────────────────────────────────────────────────────────────
export const deleteBook = async (bookId) => {
  const book = await Book.findById(bookId);
  if (!book) {
    const err = new Error("Book not found");
    err.statusCode = 404;
    throw err;
  }

  // Active borrow request থাকলে delete করা যাবে না
  const activeRequests = await BookRequest.countDocuments({
    book: bookId,
    status: { $in: ["pending", "approved", "issued", "waitlisted"] },
  });

  if (activeRequests > 0) {
    const err = new Error(
      "Cannot delete book with active borrow requests. Deactivate it instead."
    );
    err.statusCode = 400;
    throw err;
  }

  // Cloudinary cleanup
  if (book.coverImage?.publicId) {
    await cloudinary.uploader.destroy(book.coverImage.publicId);
  }
  if (book.digital?.filePublicId) {
    await cloudinary.uploader.destroy(book.digital.filePublicId, {
      resource_type: "raw",
    });
  }

  await book.deleteOne();
  return { message: "Book deleted successfully" };
};

// ═══════════════════════════════════════════════════════════════════════════════
// FILE UPLOADS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Upload Cover Image ───────────────────────────────────────────────────────
export const uploadCoverImage = async (bookId, fileBuffer, mimetype) => {
  const book = await Book.findById(bookId);
  if (!book) {
    const err = new Error("Book not found");
    err.statusCode = 404;
    throw err;
  }

  // পুরানো cover মুছে ফেলা
  if (book.coverImage?.publicId) {
    await cloudinary.uploader.destroy(book.coverImage.publicId);
  }

  const result = await uploadToCloudinary(fileBuffer, {
    folder: "foundation/library/covers",
    resource_type: "image",
    transformation: [{ width: 400, height: 600, crop: "fill", quality: "auto" }],
  });

  book.coverImage = {
    url: result.secure_url,
    publicId: result.public_id,
  };

  await book.save();
  return book;
};

// ─── Upload Digital File ──────────────────────────────────────────────────────
export const uploadDigitalFile = async (bookId, fileBuffer, originalname) => {
  const book = await Book.findById(bookId);
  if (!book) {
    const err = new Error("Book not found");
    err.statusCode = 404;
    throw err;
  }

  if (book.bookType === "physical") {
    const err = new Error(
      "Cannot upload digital file to a physical-only book. Change bookType first."
    );
    err.statusCode = 400;
    throw err;
  }

  // পুরানো file মুছে ফেলা
  if (book.digital?.filePublicId) {
    await cloudinary.uploader.destroy(book.digital.filePublicId, {
      resource_type: "raw",
    });
  }

  // Extension detect
  const ext = originalname.split(".").pop().toLowerCase();
  const allowedFormats = ["pdf", "epub", "mobi"];
  if (!allowedFormats.includes(ext)) {
    const err = new Error("Only pdf, epub, mobi files are allowed");
    err.statusCode = 400;
    throw err;
  }

  const result = await uploadToCloudinary(fileBuffer, {
    folder: "foundation/library/files",
    resource_type: "raw",
    format: ext,
  });

  const fileSizeMb = parseFloat((fileBuffer.length / (1024 * 1024)).toFixed(2));

  book.digital = {
    fileUrl: result.secure_url,
    filePublicId: result.public_id,
    fileFormat: ext,
    fileSizeMb,
  };

  await book.save();
  return book;
};

// ═══════════════════════════════════════════════════════════════════════════════
// REVIEWS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Add Review ───────────────────────────────────────────────────────────────
export const addReview = async (bookId, userId, { rating, comment }) => {
  const book = await Book.findById(bookId);
  if (!book) {
    const err = new Error("Book not found");
    err.statusCode = 404;
    throw err;
  }

  // Duplicate review check
  const alreadyReviewed = book.reviews.some(
    (r) => r.user.toString() === userId.toString()
  );
  if (alreadyReviewed) {
    const err = new Error(
      "You have already reviewed this book. Edit your existing review."
    );
    err.statusCode = 400;
    throw err;
  }

  book.reviews.push({ user: userId, rating, comment });
  await book.save(); // pre-save এ averageRating update হবে

  return book;
};

// ─── Update Review ────────────────────────────────────────────────────────────
export const updateReview = async (bookId, userId, { rating, comment }) => {
  const book = await Book.findById(bookId);
  if (!book) {
    const err = new Error("Book not found");
    err.statusCode = 404;
    throw err;
  }

  const review = book.reviews.find(
    (r) => r.user.toString() === userId.toString()
  );
  if (!review) {
    const err = new Error("Review not found");
    err.statusCode = 404;
    throw err;
  }

  if (rating !== undefined) review.rating = rating;
  if (comment !== undefined) review.comment = comment;

  await book.save();
  return book;
};

// ─── Delete Review ────────────────────────────────────────────────────────────
export const deleteReview = async (bookId, userId, userRole) => {
  const book = await Book.findById(bookId);
  if (!book) {
    const err = new Error("Book not found");
    err.statusCode = 404;
    throw err;
  }

  const reviewIndex = book.reviews.findIndex(
    (r) => r.user.toString() === userId.toString()
  );

  // Admin যেকোনো review মুছতে পারবে
  if (reviewIndex === -1 && userRole !== "admin") {
    const err = new Error("Review not found or you are not authorized");
    err.statusCode = 404;
    throw err;
  }

  if (reviewIndex !== -1) {
    book.reviews.splice(reviewIndex, 1);
  }

  await book.save();
  return book;
};
