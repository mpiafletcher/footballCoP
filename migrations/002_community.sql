ALTER TABLE exercises ADD COLUMN source_id uuid REFERENCES exercises(id) ON DELETE SET NULL;
ALTER TABLE exercises ADD COLUMN attribution jsonb;
CREATE INDEX exercises_source_idx ON exercises(source_id);
CREATE INDEX exercises_public_idx ON exercises(updated_at DESC) WHERE visibility = 'public';

CREATE TABLE exercise_versions (
  exercise_id uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version > 0),
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(exercise_id, version)
);
CREATE TABLE exercise_comments (
  id uuid PRIMARY KEY,
  exercise_id uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  coach_id uuid NOT NULL REFERENCES coaches(id),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE practical_reviews (
  id uuid PRIMARY KEY,
  exercise_id uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  coach_id uuid NOT NULL REFERENCES coaches(id),
  variant_id uuid REFERENCES exercises(id) ON DELETE SET NULL,
  age text,
  player_count integer CHECK (player_count > 0),
  space_used text,
  worked text,
  did_not_work text,
  changes text,
  published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE exercise_reactions (
  exercise_id uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  coach_id uuid NOT NULL REFERENCES coaches(id),
  kind text NOT NULL CHECK (kind IN ('like', 'bookmark')),
  PRIMARY KEY(exercise_id, coach_id, kind)
);
CREATE TABLE exercise_reports (
  id uuid PRIMARY KEY,
  exercise_id uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES coaches(id),
  moderator_id uuid REFERENCES coaches(id),
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE exercise_features (
  exercise_id uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('featured', 'exercise_of_the_week')),
  starts_on date NOT NULL,
  ends_on date,
  PRIMARY KEY (exercise_id, kind, starts_on),
  CHECK (ends_on IS NULL OR ends_on >= starts_on)
);
