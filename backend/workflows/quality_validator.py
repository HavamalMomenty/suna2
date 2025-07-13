#made by adrian
import asyncio
import json
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime, timezone
from utils.logger import logger
from dataclasses import dataclass
from enum import Enum

class ValidationResult(Enum):
    PASSED = "passed"
    FAILED = "failed"
    NEEDS_CORRECTION = "needs_correction"

@dataclass
class QualityCheckResult:
    """Result of quality validation check."""
    result: ValidationResult
    score: float  # 0.0 to 1.0
    issues: List[str]
    suggestions: List[str]
    validation_prompt: Optional[str] = None
    corrected_output: Optional[str] = None
    correction_prompt: Optional[str] = None
    
    @property
    def needs_correction(self) -> bool:
        """Check if correction is needed based on result."""
        return self.result == ValidationResult.NEEDS_CORRECTION

class ThylanderWorkflowValidator:
    """
    Quality validator specifically designed for Thylander Real Estate PE workflow.
    Validates investment memorandum underwriting and IC paper outputs.
    """
    
    def __init__(self):
        self.validation_criteria = {
            "template_adherence": {
                "weight": 0.3,
                "description": "Output follows the provided template structure"
            },
            "financial_consistency": {
                "weight": 0.4,
                "description": "Financial calculations are consistent and reasonable"
            },
            "completeness": {
                "weight": 0.2,
                "description": "All required sections are filled out"
            },
            "data_accuracy": {
                "weight": 0.1,
                "description": "Data extracted from investment memorandum is accurate"
            }
        }
    
    async def validate_workflow_output(
        self, 
        workflow_output: Dict[str, Any],
        original_input: Dict[str, Any],
        template_content: Optional[str] = None
    ) -> QualityCheckResult:
        """
        Validate the workflow output against quality criteria.
        
        Args:
            workflow_output: The complete output from the workflow
            original_input: The original investment memorandum input
            template_content: The template that should have been used
        
        Returns:
            QualityCheckResult with validation results
        """
        logger.info("Starting quality validation for Thylander workflow output")
        
        try:
            # Extract the relevant content from workflow output
            output_content = self._extract_output_content(workflow_output)
            
            if not output_content:
                return QualityCheckResult(
                    result=ValidationResult.FAILED,
                    score=0.0,
                    issues=["No valid output content found"],
                    suggestions=["Ensure the workflow produces output content"]
                )
            
            # Perform LLM-based validation
            validation_result = await self._perform_llm_validation(
                output_content, original_input, template_content
            )
            
            logger.info(f"Quality validation completed with score: {validation_result.score}")
            return validation_result
            
        except Exception as e:
            logger.error(f"Error during quality validation: {e}")
            return QualityCheckResult(
                result=ValidationResult.FAILED,
                score=0.0,
                issues=[f"Validation error: {str(e)}"],
                suggestions=["Check workflow output format and try again"]
            )
    
    def _extract_output_content(self, workflow_output: Dict[str, Any]) -> Optional[str]:
        """Extract the main content from workflow output."""
        # Look for common output keys
        content_keys = ['content', 'output', 'result', 'ic_paper', 'underwriting', 'response']
        
        for key in content_keys:
            if key in workflow_output and workflow_output[key]:
                if isinstance(workflow_output[key], str):
                    return workflow_output[key]
                elif isinstance(workflow_output[key], dict):
                    # Try to extract text content from nested structure
                    for sub_key in ['text', 'content', 'html', 'markdown']:
                        if sub_key in workflow_output[key]:
                            return workflow_output[key][sub_key]
        
        # If no specific key found, try to get the last message or response
        if 'messages' in workflow_output and workflow_output['messages']:
            last_message = workflow_output['messages'][-1]
            if isinstance(last_message, dict) and 'content' in last_message:
                return last_message['content']
        
        return None
    
    async def _perform_llm_validation(
        self, 
        output_content: str,
        original_input: Dict[str, Any],
        template_content: Optional[str] = None
    ) -> QualityCheckResult:
        """Use LLM to validate the output quality."""
        
        validation_prompt = self._build_validation_prompt(
            output_content, original_input, template_content
        )
        
        try:
            # Import the LLM runner
            from agent.run import run_single_llm_call
            
            # Perform validation using LLM
            validation_response = await run_single_llm_call(
                prompt=validation_prompt,
                model_name="anthropic/claude-sonnet-4-20250514",
                system_prompt=self._get_validation_system_prompt()
            )
            
            # Parse the validation response
            return self._parse_validation_response(validation_response, validation_prompt)
            
        except Exception as e:
            logger.error(f"Error in LLM validation: {e}")
            # Fallback to basic validation
            return await self._basic_validation(output_content, template_content)
    
    def _build_validation_prompt(
        self, 
        output_content: str,
        original_input: Dict[str, Any],
        template_content: Optional[str] = None
    ) -> str:
        """Build the validation prompt for the LLM."""
        
        prompt = f"""
VALIDATION TASK: Analyze the quality of an investment underwriting and IC paper output.

ORIGINAL INVESTMENT MEMORANDUM INPUT:
{json.dumps(original_input, indent=2)}

{"EXPECTED TEMPLATE:" if template_content else ""}
{template_content or "No specific template provided"}

WORKFLOW OUTPUT TO VALIDATE:
{output_content}

Please evaluate this output on the following criteria:

1. TEMPLATE ADHERENCE (30%): Does the output follow the expected template structure?
2. FINANCIAL CONSISTENCY (40%): Are financial calculations consistent and reasonable?
3. COMPLETENESS (20%): Are all required sections filled out?
4. DATA ACCURACY (10%): Is data from the investment memorandum accurately extracted?

Provide your analysis in the following JSON format:
{{
    "overall_score": 0.85,
    "template_adherence": {{
        "score": 0.9,
        "issues": ["List any template adherence issues"],
        "suggestions": ["List suggestions for improvement"]
    }},
    "financial_consistency": {{
        "score": 0.8,
        "issues": ["List any financial consistency issues"],
        "suggestions": ["List suggestions for improvement"]
    }},
    "completeness": {{
        "score": 0.9,
        "issues": ["List any completeness issues"],
        "suggestions": ["List suggestions for improvement"]
    }},
    "data_accuracy": {{
        "score": 0.85,
        "issues": ["List any data accuracy issues"],
        "suggestions": ["List suggestions for improvement"]
    }},
    "overall_assessment": "Summary of the overall quality",
    "needs_correction": true/false,
    "correction_instructions": "Specific instructions for corrections if needed"
}}
"""
        return prompt
    
    def _get_validation_system_prompt(self) -> str:
        """Get the system prompt for validation."""
        return """
You are an expert validator for private equity real estate investment analysis. 
Your role is to assess the quality of investment underwriting and IC papers.

Focus on:
- Accuracy of financial calculations and projections
- Adherence to professional PE standards and templates
- Completeness of analysis sections
- Consistency in data usage throughout the document
- Professional presentation and formatting

Be thorough but fair in your assessment. Flag significant issues but don't be overly critical of minor formatting differences.
Always provide constructive suggestions for improvement.
"""
    
    def _parse_validation_response(self, response: str, validation_prompt: str) -> QualityCheckResult:
        """Parse the LLM validation response into structured result."""
        try:
            # Try to extract JSON from the response
            json_start = response.find('{')
            json_end = response.rfind('}') + 1
            
            if json_start != -1 and json_end > json_start:
                json_str = response[json_start:json_end]
                validation_data = json.loads(json_str)
                
                overall_score = validation_data.get('overall_score', 0.5)
                needs_correction = validation_data.get('needs_correction', False)
                
                # Collect all issues and suggestions
                all_issues = []
                all_suggestions = []
                
                for criterion in ['template_adherence', 'financial_consistency', 'completeness', 'data_accuracy']:
                    if criterion in validation_data:
                        criterion_data = validation_data[criterion]
                        all_issues.extend(criterion_data.get('issues', []))
                        all_suggestions.extend(criterion_data.get('suggestions', []))
                
                # Add overall assessment
                overall_assessment = validation_data.get('overall_assessment', '')
                if overall_assessment:
                    all_suggestions.append(f"Overall: {overall_assessment}")
                
                # Determine result
                if overall_score >= 0.8 and not needs_correction:
                    result = ValidationResult.PASSED
                elif needs_correction:
                    result = ValidationResult.NEEDS_CORRECTION
                else:
                    result = ValidationResult.FAILED
                
                return QualityCheckResult(
                    result=result,
                    score=overall_score,
                    issues=all_issues,
                    suggestions=all_suggestions,
                    validation_prompt=validation_prompt
                )
            
        except Exception as e:
            logger.error(f"Error parsing validation response: {e}")
        
        # Fallback result
        return QualityCheckResult(
            result=ValidationResult.NEEDS_CORRECTION,
            score=0.5,
            issues=["Could not parse validation response"],
            suggestions=["Manual review recommended"],
            validation_prompt=validation_prompt
        )
    
    async def _basic_validation(self, output_content: str, template_content: Optional[str]) -> QualityCheckResult:
        """Perform basic validation without LLM (fallback)."""
        issues = []
        suggestions = []
        score = 0.7  # Default moderate score
        
        # Basic checks
        if len(output_content) < 100:
            issues.append("Output content is too short")
            score -= 0.2
        
        if template_content and len(template_content) > 100:
            # Check if output follows some template structure
            template_sections = self._extract_sections(template_content)
            output_sections = self._extract_sections(output_content)
            
            missing_sections = set(template_sections) - set(output_sections)
            if missing_sections:
                issues.append(f"Missing template sections: {', '.join(missing_sections)}")
                score -= 0.1 * len(missing_sections)
        
        if not issues:
            suggestions.append("Output appears to meet basic quality criteria")
        else:
            suggestions.append("Address the identified issues to improve quality")
        
        result = ValidationResult.PASSED if score >= 0.8 else ValidationResult.NEEDS_CORRECTION
        
        return QualityCheckResult(
            result=result,
            score=max(0.0, score),
            issues=issues,
            suggestions=suggestions
        )
    
    def _extract_sections(self, content: str) -> List[str]:
        """Extract section headers from content."""
        import re
        # Look for headers (markdown or HTML style)
        headers = re.findall(r'(?:^|\n)#+\s+(.+)|<h[1-6][^>]*>(.+?)</h[1-6]>', content, re.MULTILINE)
        return [h[0] or h[1] for h in headers if h[0] or h[1]]
    
    async def generate_correction_prompt(
        self, 
        original_output: str,
        validation_result: QualityCheckResult,
        original_input: Dict[str, Any],
        template_content: Optional[str] = None
    ) -> str:
        """Generate a correction prompt based on validation results."""
        
        correction_prompt = f"""
CORRECTION TASK: The workflow output needs improvement based on quality validation.

VALIDATION RESULTS:
- Overall Score: {validation_result.score:.2f}
- Issues Identified: {len(validation_result.issues)}
- Needs Correction: {validation_result.result == ValidationResult.NEEDS_CORRECTION}

SPECIFIC ISSUES TO ADDRESS:
{chr(10).join(f"- {issue}" for issue in validation_result.issues)}

SUGGESTED IMPROVEMENTS:
{chr(10).join(f"- {suggestion}" for suggestion in validation_result.suggestions)}

ORIGINAL INPUT DATA:
{json.dumps(original_input, indent=2)}

{"EXPECTED TEMPLATE TO FOLLOW:" if template_content else ""}
{template_content or "No specific template provided"}

CURRENT OUTPUT TO IMPROVE:
{original_output}

Please provide a corrected version that addresses the identified issues while maintaining accuracy and professionalism.
Focus particularly on:
1. Following the template structure more closely
2. Ensuring financial calculations are consistent
3. Completing any missing sections
4. Improving data accuracy where needed

CORRECTED OUTPUT:
"""
        
        return correction_prompt
