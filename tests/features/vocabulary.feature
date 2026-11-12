@voka
Feature: Vocabulary lists
  Signed-in learners can browse subjects, inspect list cards, filter unlearned cards and edit text.

  Scenario: Browse and filter an existing vocabulary list
    Given I open the Voka app
    When I sign in as "alice@example.test" with password "correct-password"
    And I return to vocabulary home
    Then I see subjects grouped on the home screen
    When I open the English subject
    And I open the irregular verbs list
    Then the list filters and sorting work
    And I can open the card editor without editing progress
