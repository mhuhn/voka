@voka @mixed
Feature: Mixed subject learning from My subjects
  The learner can choose several subjects, optionally narrow by all selected
  tags and study today's cards grouped by subject in a single query.

  Scenario: Select subjects and tags with immediate due-card preview
    Given I open the Voka app
    When I sign in as "alice@example.test" with password "correct-password"
    And I return to vocabulary home
    And I open the multi-subject learning selector
    Then the live count uses selected subjects and every selected tag
    When I start learning the selected subjects and tags
    Then the learning session processes the subjects in order with a transition
