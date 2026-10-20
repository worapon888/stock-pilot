package response

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type Envelope struct {
	Success bool        `json:"success"`
	Message string      `json:"message,omitempty"`
	Data    interface{} `json:"data,omitempty"`
	Meta    interface{} `json:"meta,omitempty"`
	Error   *APIError   `json:"error,omitempty"`
}

type APIError struct {
	Code    string      `json:"code"`
	Message string      `json:"message"`
	Details interface{} `json:"details,omitempty"`
}

type PaginationMeta struct {
	Page       int   `json:"page"`
	PageSize   int   `json:"page_size"`
	TotalItems int64 `json:"total_items"`
	TotalPages int   `json:"total_pages"`
}

func OK(c *gin.Context, data interface{}, message ...string) {
	msg := ""
	if len(message) > 0 {
		msg = message[0]
	}
	c.JSON(http.StatusOK, Envelope{
		Success: true,
		Message: msg,
		Data:    data,
	})
}

func OKWithMeta(c *gin.Context, data interface{}, meta interface{}, message ...string) {
	msg := ""
	if len(message) > 0 {
		msg = message[0]
	}
	c.JSON(http.StatusOK, Envelope{
		Success: true,
		Message: msg,
		Data:    data,
		Meta:    meta,
	})
}

func Created(c *gin.Context, data interface{}, message ...string) {
	msg := "Resource created successfully"
	if len(message) > 0 {
		msg = message[0]
	}
	c.JSON(http.StatusCreated, Envelope{
		Success: true,
		Message: msg,
		Data:    data,
	})
}

func Error(c *gin.Context, status int, code, message string, details ...interface{}) {
	var detail interface{}
	if len(details) > 0 {
		detail = details[0]
	}
	c.JSON(status, Envelope{
		Success: false,
		Error: &APIError{
			Code:    code,
			Message: message,
			Details: detail,
		},
	})
}

func BadRequest(c *gin.Context, message string, details ...interface{}) {
	Error(c, http.StatusBadRequest, "BAD_REQUEST", message, details...)
}

func NotFound(c *gin.Context, message string) {
	Error(c, http.StatusNotFound, "NOT_FOUND", message)
}

func Conflict(c *gin.Context, message string, details ...interface{}) {
	Error(c, http.StatusConflict, "CONFLICT", message, details...)
}

func UnprocessableEntity(c *gin.Context, message string, details ...interface{}) {
	Error(c, http.StatusUnprocessableEntity, "UNPROCESSABLE_ENTITY", message, details...)
}

func Unauthorized(c *gin.Context, message string, details ...interface{}) {
	Error(c, http.StatusUnauthorized, "UNAUTHORIZED", message, details...)
}

func Forbidden(c *gin.Context, message string, details ...interface{}) {
	Error(c, http.StatusForbidden, "FORBIDDEN", message, details...)
}

func TooManyRequests(c *gin.Context, message string, details ...interface{}) {
	Error(c, http.StatusTooManyRequests, "TOO_MANY_REQUESTS", message, details...)
}

func InternalServerError(c *gin.Context, message string) {
	Error(c, http.StatusInternalServerError, "INTERNAL_SERVER_ERROR", message)
}
