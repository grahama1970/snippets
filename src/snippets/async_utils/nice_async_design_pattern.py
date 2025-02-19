"""
Using the nice async design pattern, we can process all questions concurrently with rate limiting.
Using asyncio.as_completed, we can process the tasks as they complete, rather than waiting for all tasks to complete.
then use pbar.update(1) to update the progress bar as each task completes.
"""

"""
 Code Snippet
 async with aiohttp.ClientSession() as session:
        # Create tasks for all questions
        tasks = [process_single_question(session, example) for example in dataset]
        
        # Process all tasks concurrently with a progress bar
        results = []
        with tqdm(total=len(tasks), desc="Processing questions") as pbar:
            for coro in asyncio.as_completed(tasks):
                result = await coro
                results.append(result)
                pbar.update(1)
"""

# example usage
async def process_questions(dataset: List[Dict], model_name: str, results_dir: str, num_samples: int, is_arc: bool = False, wait_enabled: bool = False, suppress_logs: bool = False, no_think_tags: bool = False, use_reasoning: bool = False) -> Tuple[List[Dict], int, Optional[Dict]]:
    """Process all questions concurrently with rate limiting."""
    # Initialize rate limiters
    sglang_semaphore = asyncio.Semaphore(MAX_CONCURRENT_SGLANG)
    gemini_semaphore = asyncio.Semaphore(MAX_CONCURRENT_GEMINI)
    
    # Initialize answer checker with the Gemini semaphore
    checker = AnswerChecker(semaphore=gemini_semaphore, no_think_tags=no_think_tags) if not is_arc else None
    
    # Track successful wait retries
    wait_successes = 0
    
    async def process_single_question(session: aiohttp.ClientSession, example: Dict) -> Dict:
        nonlocal wait_successes
        if is_arc:
            # Format ARC question with training examples
            question = format_arc_question(example["input"], example.get("train", []))
            model_answers = await get_model_answer(session, question, model_name, sglang_semaphore, num_samples, is_arc=True, wait_enabled=wait_enabled, use_reasoning=use_reasoning)
            
            # Process each sample
            samples = []
            for answer in model_answers:
                # Check answer using ARC checker
                check_result = check_arc_answer(
                    question=example,
                    model_answer=answer,
                    ground_truth=example["output"],
                    no_think_tags=no_think_tags
                )
                
                # If wait is enabled and answer is incorrect but has valid think tags, try again
                if wait_enabled and not check_result["is_correct"] and has_single_think_tag_pair(answer):
                    partial_response = extract_partial_response(answer, suppress_logs)
                    retry_answers = await get_model_answer(
                        session, question, model_name, sglang_semaphore,
                        num_samples=1, is_arc=True, wait_enabled=True,
                        partial_response=partial_response, use_reasoning=use_reasoning
                    )
                    if retry_answers and retry_answers[0]:
                        # Combine the partial response with the new completion
                        combined_answer = partial_response + retry_answers[0]
                        # Check the combined answer
                        retry_result = check_arc_answer(
                            question=example,
                            model_answer=combined_answer,
                            ground_truth=example["output"],
                            no_think_tags=no_think_tags
                        )
                        # Track if retry succeeded
                        if retry_result["is_correct"]:
                            wait_successes += 1
                        # Always use the retry result since it's our last attempt
                        check_result = retry_result
                        answer = combined_answer
                
                sample = {
                    "output": answer,
                    "is_correct": check_result["is_correct"],
                }
                
                # Only include extracted_answer if grid was successfully extracted
                if check_result["extracted_answer"]:
                    sample["extracted_answer"] = check_result["extracted_answer"]
                
                samples.append(sample)
            
            result = {
                "task_id": example["task_id"],
                "prompt": question,
                "input": example["input"],
                "ground_truth": example["output"],
                "samples": samples,
            }
            
        else:
            # Process GSM8K question
            model_answers = await get_model_answer(session, example["question"], model_name, sglang_semaphore, num_samples, wait_enabled=wait_enabled, use_reasoning=use_reasoning)
            
            # Process each sample
            samples = []
            for answer in model_answers:
                check_result = await checker.check_answer_async(
                    question=example["question"],
                    model_answer=answer,
                    ground_truth=example["answer"]
                )
                
                # If wait is enabled and answer is incorrect but has valid think tags, try again
                if wait_enabled and not check_result["is_correct"] and has_single_think_tag_pair(answer):
                    partial_response = extract_partial_response(answer, suppress_logs)
                    retry_answers = await get_model_answer(
                        session, example["question"], model_name, sglang_semaphore,
                        num_samples=1, wait_enabled=True,
                        partial_response=partial_response, use_reasoning=use_reasoning
                    )
                    if retry_answers and retry_answers[0]:
                        # Combine the partial response with the new completion
                        combined_answer = partial_response + retry_answers[0]
                        # Check the combined answer
                        retry_result = await checker.check_answer_async(
                            question=example["question"],
                            model_answer=combined_answer,
                            ground_truth=example["answer"]
                        )
                        # Track if retry succeeded
                        if retry_result["is_correct"]:
                            wait_successes += 1
                        # Always use the retry result since it's our last attempt
                        check_result = retry_result
                        answer = combined_answer
                
                samples.append({
                    "output": answer,
                    "is_correct": check_result["is_correct"],
                })
            
            result = {
                "question": example["question"],
                "prompt": example["question"],
                "ground_truth": example["answer"],
                "samples": samples,
            }
        
        # Calculate metrics for this question
        result["metrics"] = calculate_metrics(result["samples"])
        
        # Only print metrics if not suppressing logs
        if not suppress_logs:
            print(f"\nQuestion {len(results)} metrics:")
            for metric, value in result["metrics"].items():
                if isinstance(value, float):
                    print(f"{metric}: {value:.2f}")
                else:
                    print(f"{metric}: {value}")
            print("\n" + "="*50)
            
        return result
    
    async with aiohttp.ClientSession() as session:
        # Create tasks for all questions
        tasks = [process_single_question(session, example) for example in dataset]
        
        # Process all tasks concurrently with a progress bar
        results = []
        with tqdm(total=len(tasks), desc="Processing questions") as pbar:
            for coro in asyncio.as_completed(tasks):
                result = await coro
                results.append(result)
                pbar.update(1)
                
                # Save progress after each completion
                with open(f"{results_dir}/all_inference_results.json", "w") as f:
                    json.dump(results, f, indent=2)
        
        # Get the final stats from the checker if we used it
        gemini_stats = checker.get_stats() if checker else None
        
        return results, wait_successes, gemini_stats