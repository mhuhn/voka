Feature: Account authentication
  The Voka app requires authentication before showing a profile.

  Scenario: Sign in and display the user's own profile
    Given I open the Voka app
    When I sign in as "alice@example.test" with password "correct-password"
    Then I see the profile for "alice@example.test"
    And I do not see the sign-in form

  Scenario: Registration requires email verification
    Given I open the Voka app
    When I open registration
    And I register "Alice" with email "alice@example.test" and password "correct-password"
    Then I see an email confirmation message

  Scenario: Request password reset
    Given I open the Voka app
    When I open password reset
    And I request a reset for "alice@example.test"
    Then I see a password reset message

  Scenario: Sign out
    Given I open the Voka app
    And I sign in as "alice@example.test" with password "correct-password"
    When I sign out
    Then I see the sign-in form

  Scenario: Add and switch between two persistent accounts
    Given I open the Voka app
    And I sign in as "alice@example.test" with password "correct-password"
    When I add another user
    And I sign in as "bob@example.test" with password "correct-password"
    Then I see the profile for "bob@example.test"
    When I switch to "alice@example.test"
    Then I see the profile for "alice@example.test"
    When I reload the app
    Then I see the profile for "alice@example.test"
    When I switch to "bob@example.test"
    Then I see the profile for "bob@example.test"

  @de
  Scenario: German interface and unobtrusive version label
    Given my browser prefers German
    When I open the Voka app in German
    Then I see the German sign-in form
    And Google login is hidden
    And I see the version in the bottom-left corner

  @de
  Scenario: Profile actions in de
    Given I open the Voka app in the current locale
    When I sign in using the current locale as "alice@example.test" with password "correct-password"
    Then the profile heading is "Mein Profil"
    And the profile sign-out button is "Abmelden"
    And the account section heading is "Konten"
    And the add-account button is "Weiteren Benutzer hinzufügen"

  @fr
  Scenario: Profile actions in fr
    Given I open the Voka app in the current locale
    When I sign in using the current locale as "alice@example.test" with password "correct-password"
    Then the profile heading is "Mon profil"
    And the profile sign-out button is "Se déconnecter"
    And the account section heading is "Comptes"
    And the add-account button is "Ajouter un autre utilisateur"

  @nl
  Scenario: Profile actions in nl
    Given I open the Voka app in the current locale
    When I sign in using the current locale as "alice@example.test" with password "correct-password"
    Then the profile heading is "Mijn profiel"
    And the profile sign-out button is "Uitloggen"
    And the account section heading is "Accounts"
    And the add-account button is "Nog een gebruiker toevoegen"

  @da
  Scenario: Profile actions in da
    Given I open the Voka app in the current locale
    When I sign in using the current locale as "alice@example.test" with password "correct-password"
    Then the profile heading is "Min profil"
    And the profile sign-out button is "Log ud"
    And the account section heading is "Konti"
    And the add-account button is "Tilføj en anden bruger"

  @it
  Scenario: Profile actions in it
    Given I open the Voka app in the current locale
    When I sign in using the current locale as "alice@example.test" with password "correct-password"
    Then the profile heading is "Il mio profilo"
    And the profile sign-out button is "Esci"
    And the account section heading is "Account"
    And the add-account button is "Aggiungi un altro utente"

  Scenario: Sign-in and registration match the Voka theme
    Given I open the Voka app
    Then the sign-in form uses the Voka visual theme
    When I open registration
    Then the registration form keeps that visual theme

  Scenario: iOS PWA uses the original Voka home-screen icon
    Given I open the Voka app
    Then the Voka home-screen icon is explicitly linked on iOS

  Scenario: Account color identifies the current user consistently
    Given I open the Voka app
    When I sign in as "alice@example.test" with password "correct-password"
    Then the account profile has no green-themed controls
    When I add another user
    And I sign in as "bob@example.test" with password "correct-password"
    Then each account has a different persistent profile color
    When I switch to "alice@example.test"
    Then the selected user's floating avatar retains their profile color
