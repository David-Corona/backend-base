# PRODUCT.md

## Purpose

A production-ready NestJS backend starter template that serves as a reusable foundation for multiple projects. It should be secure, maintainable, and easy to extend — not a toy example, but something you'd actually ship.

## Who Uses It

Developers (including AI agents) who need a solid backend starting point without rebuilding auth, IAM, email, and core infrastructure from scratch every time.

---

## Core Features

### Authentication
Users can register with an email and password, verify their email, log in, and log out. Sessions should be managed with short-lived access tokens and long-lived refresh tokens. A user can have multiple active sessions (e.g., different devices) and logging out should only revoke the current session.

### Password Reset
Users who forget their password can request a reset link via email. The link should expire after a short window. Using the link should invalidate it so it cannot be reused.

### Role-Based Access Control
Full RBAC with roles and permissions. Roles are assigned to users (a user can have multiple roles), and permissions are assigned to roles. Route protection is based on permissions, not roles directly — so a route requires a permission (e.g. `users:read`), and the user has that permission if any of their roles grant it. This way roles are just named collections of permissions.

### API Documentation
All endpoints should be documented via Swagger. Documentation should not clutter controllers — use custom decorators that wrap Swagger decorators, keeping controllers clean and readable.

### User Management
Admins can list, view, create, update, and delete users. Users can view and update their own profile.

### Email Notifications
Transactional emails are sent for: email verification on registration, and password reset requests. Emails should be templated (HTML), not plain strings in code.

### Health Check
A public endpoint that confirms the application is running, useful for uptime monitoring and deployment checks.

---

## Quality Expectations

- This is not a prototype. Error handling should be consistent and predictable.
- All inputs should be validated. Invalid requests should return clear, structured error responses.
- Secrets and configuration should never be hardcoded.
- The codebase should be easy for a new developer (or agent) to understand and extend without breaking existing patterns.
- The project should be runnable locally with minimal setup.
