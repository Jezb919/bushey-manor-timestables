-- SQL schema for Supabase - paste into SQL editor
create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  role text not null,
  created_at timestamptz default now()
);

create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  year int,
  label text
);

create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  student_id int unique,
  first_name text,
  last_name text,
  year int,
  class_label text,
  pin text,
  created_at timestamptz default now()
);

create table if not exists test_configs (
  id uuid primary key default gen_random_uuid(),
  name text,
  creator_id uuid references users(id),
  num_questions int,
  tables jsonb,
  multiplier_min int default 1,
  multiplier_max int default 19,
  scheduled_for timestamptz,
  created_at timestamptz default now()
);

create table if not exists test_attempts (
  id uuid primary key default gen_random_uuid(),
  test_config_id uuid references test_configs(id),
  student_id uuid references students(id),
  class_label text,
  started_at timestamptz,
  finished_at timestamptz,
  score int,
  max_score int,
  percent float,
  avg_response_time_ms int,
  completed boolean default false
);

create table if not exists question_records (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid references test_attempts(id),
  q_index int,
  base int,
  multiplier int,
  correct_answer int,
  student_answer int,
  is_correct boolean,
  response_time_ms int,
  served_at timestamptz,
  created_at timestamptz default now()
);
