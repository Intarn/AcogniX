-- UC06/UC07: atomically persist generated quiz/flashcard parents and children.
-- Adds optional idempotency keys so a retried generation request can return the
-- already-created object instead of producing duplicate rows.

alter table public."Practice_Quiz"
  add column if not exists "idempotencyKey" text;

alter table public."Flashcard_Set"
  add column if not exists "idempotencyKey" text;

create unique index if not exists "Practice_Quiz_project_idempotency_unique"
  on public."Practice_Quiz" ("projectId", "idempotencyKey")
  where "idempotencyKey" is not null;

create unique index if not exists "Flashcard_Set_project_idempotency_unique"
  on public."Flashcard_Set" ("projectId", "idempotencyKey")
  where "idempotencyKey" is not null;

create or replace function public.create_practice_quiz_with_questions(
  p_project_id uuid,
  p_question_count integer,
  p_difficulty_level text,
  p_questions jsonb,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quiz_id uuid;
  v_existing_id uuid;
  v_question jsonb;
begin
  if p_question_count < 1 or p_question_count > 20 then
    raise exception 'INVALID_QUESTION_COUNT' using errcode = '22023';
  end if;

  if jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) <> p_question_count then
    raise exception 'QUESTION_COUNT_MISMATCH' using errcode = '22023';
  end if;

  if p_idempotency_key is not null then
    select "quizId" into v_existing_id
    from "Practice_Quiz"
    where "projectId" = p_project_id and "idempotencyKey" = p_idempotency_key;

    if v_existing_id is not null then
      return jsonb_build_object('quizId', v_existing_id, 'idempotentReplay', true);
    end if;
  end if;

  begin
    insert into "Practice_Quiz" ("projectId", "questionCount", "difficultyLevel", "idempotencyKey")
    values (p_project_id, p_question_count, p_difficulty_level, p_idempotency_key)
    returning "quizId" into v_quiz_id;
  exception when unique_violation then
    if p_idempotency_key is null then
      raise;
    end if;

    select "quizId" into v_existing_id
    from "Practice_Quiz"
    where "projectId" = p_project_id and "idempotencyKey" = p_idempotency_key;

    if v_existing_id is null then
      raise;
    end if;
    return jsonb_build_object('quizId', v_existing_id, 'idempotentReplay', true);
  end;

  for v_question in select value from jsonb_array_elements(p_questions)
  loop
    if nullif(btrim(v_question->>'content'), '') is null then
      raise exception 'INVALID_QUESTION_CONTENT' using errcode = '22023';
    end if;

    insert into "Practice_Question" ("quizId", "content", "optionsJson", "correctAnswer")
    values (
      v_quiz_id,
      v_question->>'content',
      coalesce(v_question->'options', '[]'::jsonb)::text,
      v_question->>'correctAnswer'
    );
  end loop;

  return jsonb_build_object('quizId', v_quiz_id, 'idempotentReplay', false);
end;
$$;

create or replace function public.create_flashcard_set_with_cards(
  p_project_id uuid,
  p_cards jsonb,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_set_id uuid;
  v_existing_id uuid;
  v_card jsonb;
  v_position integer := 0;
begin
  if jsonb_typeof(p_cards) <> 'array' or jsonb_array_length(p_cards) < 1 or jsonb_array_length(p_cards) > 30 then
    raise exception 'INVALID_FLASHCARD_COUNT' using errcode = '22023';
  end if;

  if p_idempotency_key is not null then
    select "flashcardSetId" into v_existing_id
    from "Flashcard_Set"
    where "projectId" = p_project_id and "idempotencyKey" = p_idempotency_key;

    if v_existing_id is not null then
      return jsonb_build_object('flashcardSetId', v_existing_id, 'idempotentReplay', true);
    end if;
  end if;

  begin
    insert into "Flashcard_Set" ("projectId", "idempotencyKey")
    values (p_project_id, p_idempotency_key)
    returning "flashcardSetId" into v_set_id;
  exception when unique_violation then
    if p_idempotency_key is null then
      raise;
    end if;

    select "flashcardSetId" into v_existing_id
    from "Flashcard_Set"
    where "projectId" = p_project_id and "idempotencyKey" = p_idempotency_key;

    if v_existing_id is null then
      raise;
    end if;
    return jsonb_build_object('flashcardSetId', v_existing_id, 'idempotentReplay', true);
  end;

  for v_card in select value from jsonb_array_elements(p_cards)
  loop
    if nullif(btrim(v_card->>'front'), '') is null or nullif(btrim(v_card->>'back'), '') is null then
      raise exception 'INVALID_FLASHCARD_CONTENT' using errcode = '22023';
    end if;

    insert into "Flashcard" ("flashcardSetId", "frontContent", "backContent", "position")
    values (v_set_id, v_card->>'front', v_card->>'back', v_position);
    v_position := v_position + 1;
  end loop;

  return jsonb_build_object('flashcardSetId', v_set_id, 'idempotentReplay', false);
end;
$$;

revoke all on function public.create_practice_quiz_with_questions(uuid, integer, text, jsonb, text) from public;
revoke all on function public.create_flashcard_set_with_cards(uuid, jsonb, text) from public;
grant execute on function public.create_practice_quiz_with_questions(uuid, integer, text, jsonb, text) to service_role;
grant execute on function public.create_flashcard_set_with_cards(uuid, jsonb, text) to service_role;
