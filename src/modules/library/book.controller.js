import * as bookService from "./book.service.js";

// ─── Create Book ──────────────────────────────────────────────────────────────
export const createBook = async (req, res, next) => {
  try {
    const book = await bookService.createBook(req.body, req.user._id);
    res.status(201).json({
      success: true,
      message: "Book created successfully",
      data: book,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Get All Books ────────────────────────────────────────────────────────────
export const getAllBooks = async (req, res, next) => {
  try {
    const result = await bookService.getAllBooks(req.query);
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Get Book By ID ───────────────────────────────────────────────────────────
export const getBookById = async (req, res, next) => {
  try {
    const book = await bookService.getBookById(req.params.id);
    res.status(200).json({
      success: true,
      data: book,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Update Book ──────────────────────────────────────────────────────────────
export const updateBook = async (req, res, next) => {
  try {
    const book = await bookService.updateBook(req.params.id, req.body);
    res.status(200).json({
      success: true,
      message: "Book updated successfully",
      data: book,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Delete Book ──────────────────────────────────────────────────────────────
export const deleteBook = async (req, res, next) => {
  try {
    const result = await bookService.deleteBook(req.params.id);
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Upload Cover Image ───────────────────────────────────────────────────────
export const uploadCover = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image file provided",
      });
    }

    const book = await bookService.uploadCoverImage(
      req.params.id,
      req.file.buffer,
      req.file.mimetype
    );

    res.status(200).json({
      success: true,
      message: "Cover image uploaded successfully",
      data: { coverImage: book.coverImage },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Upload Digital File ──────────────────────────────────────────────────────
export const uploadDigitalFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file provided",
      });
    }

    const book = await bookService.uploadDigitalFile(
      req.params.id,
      req.file.buffer,
      req.file.originalname
    );

    res.status(200).json({
      success: true,
      message: "Digital file uploaded successfully",
      data: { digital: book.digital },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Add Review ───────────────────────────────────────────────────────────────
export const addReview = async (req, res, next) => {
  try {
    const book = await bookService.addReview(
      req.params.id,
      req.user._id,
      req.body
    );
    res.status(201).json({
      success: true,
      message: "Review added successfully",
      data: {
        reviews: book.reviews,
        averageRating: book.averageRating,
        totalReviews: book.totalReviews,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Update Review ────────────────────────────────────────────────────────────
export const updateReview = async (req, res, next) => {
  try {
    const book = await bookService.updateReview(
      req.params.id,
      req.user._id,
      req.body
    );
    res.status(200).json({
      success: true,
      message: "Review updated successfully",
      data: {
        reviews: book.reviews,
        averageRating: book.averageRating,
        totalReviews: book.totalReviews,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── Delete Review ────────────────────────────────────────────────────────────
export const deleteReview = async (req, res, next) => {
  try {
    const book = await bookService.deleteReview(
      req.params.id,
      req.user._id,
      req.user.role
    );
    res.status(200).json({
      success: true,
      message: "Review deleted successfully",
      data: {
        averageRating: book.averageRating,
        totalReviews: book.totalReviews,
      },
    });
  } catch (error) {
    next(error);
  }
};
