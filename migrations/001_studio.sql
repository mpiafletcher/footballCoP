CREATE TABLE coaches (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sessions (
  digest text PRIMARY KEY,
  coach_id uuid NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE INDEX sessions_expiry_idx ON sessions(expires_at);

CREATE TABLE exercises (
  id uuid PRIMARY KEY,
  author_id uuid NOT NULL REFERENCES coaches(id),
  title text NOT NULL,
  description text NOT NULL,
  objective text NOT NULL,
  age text NOT NULL,
  player_count integer NOT NULL CHECK (player_count BETWEEN 0 AND 500),
  tags text[] NOT NULL,
  visibility text NOT NULL CHECK (visibility IN ('private', 'unlisted', 'public')),
  diagram jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX exercises_author_updated_idx ON exercises(author_id, updated_at DESC);
