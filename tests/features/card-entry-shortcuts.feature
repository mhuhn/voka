@voka
Feature: Voka card entry and compact sharing controls
  Scenario: Share is a small button in the list detail heading
    Given I open the Voka app
    When I sign in as "alice@example.test" with password "correct-password"
    And I return to vocabulary home
    And I open the English subject
    And I open the irregular verbs list
    Then the share control is a small round heading button

  Scenario: Enter moves and saves while adding consecutive cards
    Given I open the Voka app
    When I sign in as "alice@example.test" with password "correct-password"
    And I return to vocabulary home
    And I open the English subject
    And I open the irregular verbs list
    And I open the add-card form
    Then Enter moves to the answer and saves a new card while staying in the editor

  Scenario: Tablet card detail back returns to My subjects
    Given I open the Voka app
    When I sign in as "alice@example.test" with password "correct-password"
    And I return to vocabulary home
    And I switch to iPad landscape width
    And I open the English subject
    And I open the irregular verbs list
    And I open the first card for tablet navigation
    Then the tablet overview back arrow returns straight to My subjects
