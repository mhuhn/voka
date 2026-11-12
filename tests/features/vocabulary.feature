@voka
Feature: Vocabulary lists
  Signed-in learners can browse subjects, filter cards and use tablet and phone layouts.

  Scenario: Browse and filter an existing vocabulary list on a tablet
    Given I open the Voka app
    When I sign in as "alice@example.test" with password "correct-password"
    And I return to vocabulary home
    Then I see subjects grouped on the home screen
    And the initial subject group order and tablet subjects are correct
    When I open the English subject
    And I open the irregular verbs list
    Then the list detail is beside the complete subject list overview
    And the list header is compact without properties or learning notices
    And the list filters and sorting work
    And I can open the card editor without editing progress
    And the tablet card editor opens to the right of the full list details
    And the card editor occupies a third column

  Scenario: New lists for a language use its name as the answer label
    Given I open the Voka app
    When I sign in as "alice@example.test" with password "correct-password"
    And I return to vocabulary home
    And I open the English subject
    Then the language list form uses automatic labels
    And the direction control is a full-width push button

  Scenario: A phone shows only the editor for an opened card
    Given I open the Voka app
    When I sign in as "alice@example.test" with password "correct-password"
    And I return to vocabulary home
    And I switch to a phone-sized viewport
    And I open the English subject
    And I open the irregular verbs list
    Then I can open the card editor without editing progress
    And the phone card editor stands alone with a floating star
